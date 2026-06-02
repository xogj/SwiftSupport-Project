import * as cdk from 'aws-cdk-lib'
import * as pipelines from 'aws-cdk-lib/pipelines'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'

export class SwiftSupportAISecurityPipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const pipeline = new pipelines.CodePipeline(this, 'SwiftSupportPipeline', {
            synth: new pipelines.ShellStep('Synth', {
                input: pipelines.CodePipelineSource.connection('SwiftSupport/repo', 'main', {
                    connectionArn: 'arn:aws:codestar-connections:region:account-id:connection/connection-id'
                }),
                commands: ['npm ci', 'npm run build', 'npx cdk synth']
            })
        })

        pipeline.addStage(new SwiftSupportAISecurityTestingStage(this, 'SwiftSupportAITesting'))
    }
}

class SwiftSupportAISecurityTestingStage extends cdk.Stage {
    constructor(scope: Construct, id: string, props?: cdk.StageProps) {
        super(scope, id, props)

        const testProject = new codebuild.Project(this, 'AISecurityTest', {
            projectName: 'ai-security-eval',
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        commands: ['npm ci']
                    },
                    build: {
                        commands: ['npx ts-node run-security-test.ts']
                    }
                }
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0
            }
        })

        testProject.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: ['*']
        }))
    }
}