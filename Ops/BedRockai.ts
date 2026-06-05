import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'

export class MyBedRockStackSwiftSupport extends cdk.Stack {
    public readonly modelArn: string;
    public readonly bedrockInvokePolicy: iam.ManagedPolicy;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Bedrock foundation models are managed by AWS — we don't create the model,
        // we authorize Lambda (and the data-science role) to invoke a specific model.
        // Pinning a specific model ARN keeps least privilege rather than 'bedrock:*'.
        const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
        this.modelArn = `arn:aws:bedrock:${this.region}::foundation-model/${modelId}`;

        this.bedrockInvokePolicy = new iam.ManagedPolicy(this, 'SwiftSupportBedrockInvoke', {
            description: 'Allows invoking the SwiftSupport foundation model only',
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'bedrock:InvokeModel',
                        'bedrock:InvokeModelWithResponseStream'
                    ],
                    resources: [this.modelArn]
                })
            ]
        });

        new cdk.CfnOutput(this, 'BedrockModelArn', { value: this.modelArn });
    }
}
