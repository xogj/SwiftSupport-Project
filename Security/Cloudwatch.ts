import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cwactions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as apigw from 'aws-cdk-lib/aws-apigateway'

export interface SwiftSupportCloudwatchProps extends cdk.StackProps {
    ticketHandler: lambda.IFunction;
    ticketTable: dynamodb.ITableV2;
    api: apigw.IRestApi;
    notificationEmail: string;
}

export class SwiftSupportCloudwatch extends cdk.Stack {
    public readonly alarmTopic: sns.Topic;

    constructor(scope: Construct, id: string, props: SwiftSupportCloudwatchProps) {
        super(scope, id, props);

        this.alarmTopic = new sns.Topic(this, 'SwiftSupportAlarmTopic', {
            displayName: 'SwiftSupport Alarm Notifications',
            topicName: 'SwiftSupport-Alarms'
        });

        // CRITICAL: alarms route to a real inbox. Without a subscription, alerts fire silently.
        this.alarmTopic.addSubscription(new subscriptions.EmailSubscription(props.notificationEmail));

        const lambdaErrors = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
            alarmName: 'SwiftSupport-Lambda-Errors',
            metric: props.ticketHandler.metricErrors({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
            threshold: 5,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });

        const lambdaThrottles = new cloudwatch.Alarm(this, 'LambdaThrottleAlarm', {
            alarmName: 'SwiftSupport-Lambda-Throttles',
            metric: props.ticketHandler.metricThrottles({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });

        const ddbThrottles = new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
            alarmName: 'SwiftSupport-Dynamo-Throttles',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ThrottledRequests',
                dimensionsMap: { TableName: props.ticketTable.tableName },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5)
            }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });

        const api5xx = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
            alarmName: 'SwiftSupport-Api-5xx',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '5XXError',
                dimensionsMap: { ApiName: props.api.restApiName },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5)
            }),
            threshold: 5,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });

        const wafBlocked = new cloudwatch.Alarm(this, 'WafBlockSurgeAlarm', {
            alarmName: 'SwiftSupport-WAF-Block-Surge',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/WAFV2',
                metricName: 'BlockedRequests',
                dimensionsMap: { WebACL: 'SwiftSupport-WAF-Regional', Region: this.region, Rule: 'ALL' },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5)
            }),
            threshold: 100,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });

        const snsAction = new cwactions.SnsAction(this.alarmTopic);
        for (const alarm of [lambdaErrors, lambdaThrottles, ddbThrottles, api5xx, wafBlocked]) {
            alarm.addAlarmAction(snsAction);
        }

        new cloudwatch.Dashboard(this, 'SwiftSupportDashboard', {
            dashboardName: 'SwiftSupport-Production',
            widgets: [
                [
                    new cloudwatch.GraphWidget({
                        title: 'Lambda invocations & errors',
                        left: [props.ticketHandler.metricInvocations(), props.ticketHandler.metricErrors()]
                    }),
                    new cloudwatch.GraphWidget({
                        title: 'API Gateway 5xx',
                        left: [api5xx.metric]
                    })
                ]
            ]
        });

        new cdk.CfnOutput(this, 'AlarmTopicArn', { value: this.alarmTopic.topicArn });
    }
}
