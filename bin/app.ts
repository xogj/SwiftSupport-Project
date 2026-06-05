#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'

import { SwiftSupports3 } from '../Ops/s3-bucket'
import { dynamodbSwiftSupportStack } from '../Ops/DynamoDB'
import { MyBedRockStackSwiftSupport } from '../Ops/BedRockai'
import { CdkLambdaAppStack } from '../Ops/Lambda'
import { SwiftSupportDomainAPI } from '../Ops/Network/API-GW'
import { SwiftSupportCloudfront } from '../Ops/Network/Cloudfront'
import { Route53SwiftSupportStack } from '../Ops/Route53'
import { SwiftSupportWafStack } from '../Security/WAF'
import { SwiftSupportCloudwatch } from '../Security/Cloudwatch'
import { SwiftSupportAISecurityPipelineStack } from '../Security/AI.TestingAutomation'
import { DeveloperStack } from '../Ops/IAM/Developer'
import { DevOpsStackSwiftSupport } from '../Ops/IAM/DevOps'
import { SecurityPersonnelStack } from '../Ops/IAM/SecurityPersonel'
import { DataScientistStack } from '../Ops/IAM/DataScientist'
import { ProjectManagerSwiftSupportStack } from '../Ops/IAM/ProjectManager'

const app = new cdk.App()

// Stage configuration — context keys must be supplied via cdk.json or -c flags
// so synth fails loudly if someone tries to deploy without specifying account/region.
const account = app.node.tryGetContext('account') ?? process.env.CDK_DEFAULT_ACCOUNT
const primaryRegion = app.node.tryGetContext('primaryRegion') ?? process.env.CDK_DEFAULT_REGION ?? 'us-east-2'
const notificationEmail = app.node.tryGetContext('notificationEmail') ?? 'security@swiftsupport.com'
const hostedZoneName = app.node.tryGetContext('hostedZoneName') ?? 'swiftsupport.com'
const codeStarConnectionArn = app.node.tryGetContext('codeStarConnectionArn')
const repoString = app.node.tryGetContext('repoString') ?? 'SwiftSupport/repo'

if (!account) {
    throw new Error('Missing context "account". Pass -c account=123456789012 or set CDK_DEFAULT_ACCOUNT.')
}

const primaryEnv: cdk.Environment = { account, region: primaryRegion }
const usEast1Env: cdk.Environment = { account, region: 'us-east-1' }

// Apply baseline tags everywhere so finance + security can attribute every resource.
cdk.Tags.of(app).add('Project', 'SwiftSupport')
cdk.Tags.of(app).add('Owner', 'CloudSecurity')
cdk.Tags.of(app).add('ManagedBy', 'CDK')

// ─── Data tier ──────────────────────────────────────────────────────────────
const storage = new SwiftSupports3(app, 'SwiftSupport-S3', { env: primaryEnv })
const data = new dynamodbSwiftSupportStack(app, 'SwiftSupport-DynamoDB', { env: primaryEnv })
const bedrock = new MyBedRockStackSwiftSupport(app, 'SwiftSupport-Bedrock', { env: primaryEnv })

// ─── Compute tier ───────────────────────────────────────────────────────────
const compute = new CdkLambdaAppStack(app, 'SwiftSupport-Lambda', {
    env: primaryEnv,
    table: data.ticketTable,
    tableKey: data.tableKey,
    bedrockInvokePolicy: bedrock.bedrockInvokePolicy,
    bedrockModelArn: bedrock.modelArn
})
compute.addDependency(data)
compute.addDependency(bedrock)

// ─── Edge security: two WAFs ───────────────────────────────────────────────
// Regional WAF guards the API Gateway in the primary region.
const regionalWaf = new SwiftSupportWafStack(app, 'SwiftSupport-WAF-Regional', {
    env: primaryEnv,
    scope: 'REGIONAL',
    name: 'SwiftSupport-WAF-Regional'
})

// CloudFront WAF MUST live in us-east-1 — that's a CloudFront global constraint.
const cloudFrontWaf = new SwiftSupportWafStack(app, 'SwiftSupport-WAF-CloudFront', {
    env: usEast1Env,
    scope: 'CLOUDFRONT',
    name: 'SwiftSupport-WAF-CloudFront',
    crossRegionReferences: true
})

// ─── API and SPA ────────────────────────────────────────────────────────────
const api = new SwiftSupportDomainAPI(app, 'SwiftSupport-API', {
    env: primaryEnv,
    ticketHandler: compute.ticketHandler,
    regionalWebAclArn: regionalWaf.webAclArn,
    hostedZoneName
})
api.addDependency(compute)
api.addDependency(regionalWaf)

const cdn = new SwiftSupportCloudfront(app, 'SwiftSupport-CloudFront', {
    env: primaryEnv,
    crossRegionReferences: true,
    assetBucket: storage.assetBucket,
    accessLogsBucket: storage.accessLogsBucket,
    cloudFrontWebAclArn: cloudFrontWaf.webAclArn,
    runtimeConfig: {
        apiBaseUrl: api.apiUrl,
        cognitoDomain: `${api.userPoolDomain.domainName}.auth.${primaryRegion}.amazoncognito.com`,
        cognitoClientId: api.userPoolClient.userPoolClientId,
        cognitoRegion: primaryRegion
    }
})
cdn.addDependency(storage)
cdn.addDependency(cloudFrontWaf)
cdn.addDependency(api)

const dns = new Route53SwiftSupportStack(app, 'SwiftSupport-Route53', {
    env: primaryEnv,
    distribution: cdn.distribution,
    zoneName: hostedZoneName
})
dns.addDependency(cdn)

// ─── Observability ──────────────────────────────────────────────────────────
const monitoring = new SwiftSupportCloudwatch(app, 'SwiftSupport-CloudWatch', {
    env: primaryEnv,
    ticketHandler: compute.ticketHandler,
    ticketTable: data.ticketTable,
    api: api.api,
    notificationEmail
})
monitoring.addDependency(api)
monitoring.addDependency(compute)

// ─── IAM ────────────────────────────────────────────────────────────────────
// IAM is global — pin to us-east-1 to keep the noun-scoped exports stable.
const iamEnv: cdk.Environment = { account, region: 'us-east-1' }

new DeveloperStack(app, 'SwiftSupport-IAM-Developers', {
    env: iamEnv,
    crossRegionReferences: true,
    ticketTable: data.ticketTable
}).addDependency(data)

new DevOpsStackSwiftSupport(app, 'SwiftSupport-IAM-DevOps', { env: iamEnv })

new SecurityPersonnelStack(app, 'SwiftSupport-IAM-Security', { env: iamEnv })

new DataScientistStack(app, 'SwiftSupport-IAM-DataScientists', {
    env: iamEnv,
    crossRegionReferences: true,
    ticketTable: data.ticketTable,
    bedrockInvokePolicy: bedrock.bedrockInvokePolicy
}).addDependency(bedrock)

new ProjectManagerSwiftSupportStack(app, 'SwiftSupport-IAM-ProductManagers', { env: iamEnv })

// ─── AI security testing pipeline (optional — requires CodeStar connection) ─
if (codeStarConnectionArn) {
    new SwiftSupportAISecurityPipelineStack(app, 'SwiftSupport-AI-SecurityPipeline', {
        env: primaryEnv,
        repoString,
        branch: 'main',
        codeStarConnectionArn
    })
}

app.synth()
