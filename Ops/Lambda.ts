import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs'
import * as path from 'path'

export class CdkLambdaAppStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        new lambda.NodejsFunction(this, 'MyLambdaFunction', {
            entry: path.join(__dirname, 'lambda/lambda.ts'),
            handler: 'lambda',
            runtime: lambda.Runtime.NODEJS_LATEST,
            environment: {
                SWIFT_SUPPORT: 'enabled'
            }
        });
    }
}