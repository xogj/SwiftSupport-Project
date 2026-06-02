import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as bedrock from 'aws-cdk-lib/aws-bedrock'

export class MyBedRockStackSwiftSupport extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const agent = new bedrock.Agent(this, 'MyAgent', {
            foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0,
            instruction: 'You are the DataScientist personel assistant',
            name: 'SwiftSupportAgent'

        })
        agent.addKnowledgeBase()
    }
}