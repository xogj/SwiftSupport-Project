import * as cdk from 'aws-cdk-lib'
import * as pipelines from 'aws-cdk-lib/pipelines'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'

export interface SwiftSupportAISecurityPipelineProps extends cdk.StackProps {
    repoString: string;        // 'owner/repo'
    branch: string;            // e.g. 'main'
    codeStarConnectionArn: string; // arn:aws:codeconnections:...
}

export class SwiftSupportAISecurityPipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SwiftSupportAISecurityPipelineProps) {
        super(scope, id, props)

        const pipeline = new pipelines.CodePipeline(this, 'SwiftSupportPipeline', {
            pipelineName: 'SwiftSupport-AI-Security',
            crossAccountKeys: false,
            synth: new pipelines.ShellStep('Synth', {
                input: pipelines.CodePipelineSource.connection(props.repoString, props.branch, {
                    connectionArn: props.codeStarConnectionArn
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
        new SwiftSupportAITestStack(this, 'AITestRunner')
    }
}

class SwiftSupportAITestStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const testProject = new codebuild.Project(this, 'AISecurityTest', {
            projectName: 'ai-security-eval',
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: { commands: ['npm ci'] },
                    build: { commands: ['npx ts-node Security/run-security-test.ts'] }
                },
                reports: {
                    'ai-security-eval': {
                        files: ['security-report.json'],
                        'file-format': 'CUCUMBERJSON'
                    }
                }
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                privileged: false
            }
        })

        // Test runner needs to call Bedrock for the prompt-injection eval suite
        testProject.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-*`
            ]
        }))
    }
}
