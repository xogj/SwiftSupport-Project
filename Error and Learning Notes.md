# SwiftSupport CDK — Error and Learning Notes

## Code Review Score: 4/10

The foundation and architecture are correct. The right AWS services are chosen, team structure maps to IAM groups properly, and the overall request flow (CloudFront → API Gateway → Lambda → DynamoDB + Bedrock) is sound. What's needed is wiring the pieces together and fixing bugs that prevent deployment.

---

## Critical Bugs (Will Not Compile or Deploy)

### DataScientist.ts
- Variable `alice` declared but construct ID is `'Irene'` — then `Irene` and `James` are referenced as variables that don't exist. Should use `alice` and `james`.
- Second `addToPrincipalPolicy()` call is nested **inside** the parentheses of the first call — syntax error.
- Typo: `addToPrinciplePolicy` → should be `addToPrincipalPolicy`
- Typo: `iam.Policystatement` → should be `iam.PolicyStatement`
- `'dynamodb:readonly'` is not a valid IAM action — use `dynamodb:GetItem`, `dynamodb:Query`, `dynamodb:Scan`, etc.
- `resources: [dynamodb.Table.fromTableName(this, 'DynamodbSwiftSuppot')]` — missing comma before `resources`, `fromTableName` needs 3 args, and requires `.tableArn` to return a string ARN.
- Extra closing `}` brace at end of file.

### Cloudfront.ts
- Missing closing `}` — class is not properly closed, will not compile.
- `bucketName: 'SwiftSupportBucket'` — S3 bucket names must be **all lowercase**. Fails at deploy time.
- `S3Origin` used without an Origin Access Control (OAC) — CloudFront cannot read from a private bucket without OAC. All requests will return 403.

### BedRockai.ts
- `agent.addKnowledgeBase()` called with no arguments — requires a `KnowledgeBase` construct instance.

---

## Security Issues

### IAM Role Trust Policies (All IAM Stacks)
- Every role uses `assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')`.
- Human IAM users **cannot assume a role trusted by the EC2 service**.
- Fix: Use `iam.AccountPrincipal`, `iam.ArnPrincipal`, or `iam.CompositePrincipal` to allow specific users/groups to assume the role.

### Groups and Roles Are Disconnected (All IAM Stacks)
- Users are added to groups, policies are attached to roles — but there is no link between them.
- Groups have no policies attached, and nothing grants group members the ability to assume the role.
- Fix: Either attach policies directly to the group, or use `role.grantAssumeRole(group)` to allow the group to assume the role.

### Developer.ts — Overly Broad Permissions
- `lambda:*`, `apigateway:*`, `dynamodb:*` on `resources: ['*']` violates least privilege.
- The spec calls for *limited* DynamoDB access, not full control.
- CloudWatch logs viewing (per spec) is also missing.

### SecurityPersonnel.ts — No Users Created
- The group exists but no `iam.User` instances are created. Spec requires 1 security specialist.
- MFA policy is attached to the group but not the role — inconsistent with all other stacks.

### WAF.ts — Not Associated With Any Resource
- WAF ACL is created and exported but never associated with API Gateway or CloudFront.
- The WAF provides zero protection as deployed.
- CloudFront requires a **separate WAF with `CLOUDFRONT` scope** deployed in `us-east-1` — this does not exist.

### API-GW.ts — No Authorization
- No authorizer configured (no Cognito, Lambda authorizer, or API key).
- Any unauthenticated request can call the API.
- WAF is also not associated with the API Gateway.

### Route53.ts — Public S3 Bucket
- `publicReadAccess: true` exposes the bucket publicly.
- Since CloudFront is in the architecture, the bucket should be private with OAC.

---

## Architecture / Design Issues

### Three Independent S3 Buckets
- `s3-bucket.ts`, `Route53.ts`, and `Cloudfront.ts` each create separate buckets with no sharing.
- `s3-bucket.ts` has the best security config but is never referenced by anything.
- Fix: Create one shared bucket construct and pass it across stacks.

### No CDK App Entry Point
- No `bin/app.ts` or `cdk.json` exists.
- `cdk synth` cannot run — nothing can be deployed.
- Fix: Create a CDK app entry point that instantiates all stacks.

### VPC Parameter Unused
- Every IAM stack constructor accepts `vpc: ec2.IVpc` but no VPC stack exists.
- Lambda and DynamoDB stacks don't use a VPC either.
- Remove the unused parameter or build out VPC support.

### MFA Policy Duplicated Across All Stacks
- The identical `MfaEnforcement` policy block is copy-pasted into all 5 IAM stacks.
- Fix: Extract into a shared construct or AWS Managed Policy.

### DynamoDB.ts — Dangerous Removal Policy
- `removalPolicy: cdk.RemovalPolicy.DESTROY` will permanently delete all ticket data on `cdk destroy`.
- Fix: Change to `cdk.RemovalPolicy.RETAIN`.
- Also missing: point-in-time recovery (`pointInTimeRecovery: true`).

### Lambda.ts — Multiple Issues
- `lambda.Runtime.NODEJS_LATEST` is non-deterministic — pin to `NODEJS_20_X`.
- `Runtime` is imported from `aws-lambda-nodejs` but belongs in `aws-lambda`.
- No execution role grants Lambda access to DynamoDB or Bedrock.
- No timeout configured (default 3s is too short for Bedrock calls).
- Referenced handler file `lambda/lambda.ts` does not exist in the project.

### Cloudwatch.ts — Alerts Fire Silently
- SNS topic created but no email, SMS, or webhook subscription added.
- Inline Lambda handler is placeholder code only.
- `custommetrics` metric is defined but never used in any alarm.
- Only monitors one Lambda — no DynamoDB, API Gateway, or Bedrock coverage.

### AI.TestingAutomation.ts — Placeholder ARN
- `connectionArn: 'arn:aws:codestar-connections:region:account-id:connection/connection-id'` is literal placeholder text. Deployment will fail.
- `run-security-test.ts` referenced in build commands does not exist in the project.

### No Stack Environment Set
- `HostedZone.fromLookup` in `API-GW.ts` and `Route53.ts` requires an explicit `env: { account, region }` on the stack.
- Without it, CDK cannot perform the lookup and synthesis fails.

---

## What Was Done Well

- `s3-bucket.ts` — correct security defaults: `BLOCK_ALL`, `S3_MANAGED` encryption, `enforceSSL`, versioning, `RETAIN` policy.
- `SecurityPersonnel.ts` — WAF and CloudWatch permissions are granular and well-scoped.
- `ProjectManager.ts` — billing, CloudWatch read, WAF/IAM read permissions are thorough and appropriate.
- `WAF.ts` — AWS Managed Rules with CloudWatch metrics is a good starting point.
- MFA DENY-without-MFA pattern is the correct approach — needs consistent application.
- AI security testing pipeline concept (CodePipeline + CodeBuild + Bedrock) is a solid design.
- Overall service selection and architecture direction is correct.

---

## Priority Fix Order

| Priority | File | Fix |
|----------|------|-----|
| 1 | `DataScientist.ts` | Fix all syntax errors and variable name mismatches |
| 2 | `Cloudfront.ts` | Fix missing closing brace, lowercase bucket name, add OAC |
| 3 | All IAM stacks | Fix role trust policies — replace EC2 principal with account/user principal |
| 4 | All IAM stacks | Attach policies to groups or wire `grantAssumeRole` |
| 5 | `WAF.ts` | Associate WAF with API Gateway; create CLOUDFRONT-scoped WAF |
| 6 | `API-GW.ts` | Add authorization; connect to Lambda instead of MockIntegration |
| 7 | All stacks | Consolidate three S3 buckets into one shared construct |
| 8 | Project root | Create `bin/app.ts` and `cdk.json` entry point |
| 9 | `DynamoDB.ts` | Change to `RETAIN`, enable point-in-time recovery |
| 10 | `Cloudwatch.ts` | Add SNS subscriptions; replace placeholder Lambda code |

---

## Key Lessons

1. **Variable names must match references** — declaring `const alice` but referencing `Irene` is a common copy-paste error.
2. **IAM role trust policies determine WHO can assume a role** — EC2 principals are for services, not humans.
3. **Creating a group and creating a role are separate concerns** — they must be explicitly linked.
4. **Creating a WAF ACL and associating it are two different steps** — a WAF with no association protects nothing.
5. **CloudFront WAF must be CLOUDFRONT scope in us-east-1** — regional WAFs do not apply to CloudFront.
6. **S3 + CloudFront requires Origin Access Control** — a private bucket without OAC returns 403 to CloudFront.
7. **`DESTROY` removal policy on stateful resources is dangerous in production** — always use `RETAIN` for databases.
8. **CDK requires an app entry point** — stacks cannot be deployed without `bin/app.ts` and `cdk.json`.
