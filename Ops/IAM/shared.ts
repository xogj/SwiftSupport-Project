import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'

/**
 * Shared DENY-without-MFA policy. Attached to every team group so that
 * any AWS API call from a session that did not authenticate with MFA fails.
 * The iam:ChangePassword exception lets a user rotate their initial password
 * before they've enrolled MFA on first login.
 */
export const buildMfaEnforcementPolicy = (scope: Construct, id: string): iam.Policy =>
    new iam.Policy(scope, id, {
        statements: [
            new iam.PolicyStatement({
                sid: 'DenyAllWithoutMfa',
                effect: iam.Effect.DENY,
                notActions: [
                    'iam:CreateVirtualMFADevice',
                    'iam:EnableMFADevice',
                    'iam:GetUser',
                    'iam:ListMFADevices',
                    'iam:ListVirtualMFADevices',
                    'iam:ResyncMFADevice',
                    'iam:ChangePassword',
                    'sts:GetSessionToken'
                ],
                resources: ['*'],
                conditions: {
                    BoolIfExists: { 'aws:MultiFactorAuthPresent': 'false' }
                }
            })
        ]
    });

/**
 * Trust policy for human-assumable roles. Only principals in this account
 * with an active MFA session are permitted to assume the role.
 */
export const humanAssumablePrincipal = (account: string): iam.IPrincipal =>
    new iam.AccountPrincipal(account).withConditions({
        Bool: { 'aws:MultiFactorAuthPresent': 'true' },
        NumericLessThan: { 'aws:MultiFactorAuthAge': '3600' }
    });

/**
 * Wires a group → role assume-role relationship. Members of the group
 * receive sts:AssumeRole permission scoped to exactly the supplied role,
 * which keeps long-lived user credentials cleanly separated from the
 * elevated permissions that live on the role.
 */
export const grantGroupAssumeRole = (group: iam.IGroup, role: iam.IRole, id: string): void => {
    group.attachInlinePolicy(new iam.Policy(group.stack, id, {
        statements: [
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['sts:AssumeRole'],
                resources: [role.roleArn]
            })
        ]
    }));
};
