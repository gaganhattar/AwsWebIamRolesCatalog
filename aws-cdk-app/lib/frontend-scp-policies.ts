// lib/frontend-scp-policies.ts
import * as cdk from 'aws-cdk-lib';
import * as organizations from 'aws-cdk-lib/aws-organizations';
import { Construct } from 'constructs';

 /**
 * Note: This SCP stack must be deployed from the AWS Organizations 'management/root account'.
 * Requires the AWS Organization Root ID or Parent OU ID passed as a CDK context value.
 * Note:
 * - Use the following command to retrieve root ID: aws organizations list-roots --query 'Roots[0].Id' --output text
 * - Deploy using: cdk deploy --context orgRootId=r-abc123
 * - This enables SCPs and IAM roles to scope to this OU.
 */
 
export class FrontendScpPoliciesStack extends cdk.Stack {
  public readonly frontendOuId: string;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
	
	const parentId = this.node.tryGetContext('orgRootId');
    if (!parentId) {
      throw new Error("Missing required context: orgRootId. Pass it via --context or cdk.json");
    }

	// Define the OU to group frontend development accounts under the specified parent OU
    const frontendOU = new organizations.CfnOrganizationalUnit(this, 'FrontendDevTeamOU', {
      name: 'FrontendDevTeamOU',
      parentId,
    });

    this.frontendOuId = frontendOU.attrId;

    // ========== EC2 INSTANCE TYPE RESTRICTION ==========
    // Prevents launching any EC2 instance outside of cost-efficient, dev-approved types
    new organizations.CfnPolicy(this, 'DenyUnapprovedEc2TypesSCP', {
      name: 'DenyUnapprovedEc2Types',
      description: 'Deny launching non-approved EC2 instance types.',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Deny",
            Action: "ec2:RunInstances",
            Resource: "*",
            Condition: {
              StringNotEqualsIfExists: {
                "ec2:InstanceType": ["t3.micro", "t3.small", "t3.medium"]
              }
            }
          }
        ]
      },
      targetIds: [this.frontendOuId],
    });

    // ========== IAM ADMIN RESTRICTION ==========
    // Prevents IAM escalation by denying critical create/update permissions
    new organizations.CfnPolicy(this, 'DenyIAMAdminSCP', {
      name: 'DenyIAMAdminAccess',
      description: 'Deny IAM admin-level actions.',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Deny",
            Action: [
              "iam:CreateUser",
              "iam:CreateRole",
              "iam:PutRolePolicy",
              "iam:AttachRolePolicy",
              "iam:UpdateAssumeRolePolicy"
            ],
            Resource: "*"
          }
        ]
      },
      targetIds: [this.frontendOuId],
    });

    // ========== S3 PUBLIC ACCESS RESTRICTION ==========
    // Deny attempts to make buckets/objects public using ACLs
    new organizations.CfnPolicy(this, 'DenyS3PublicAccessSCP', {
      name: 'DenyS3PublicAccess',
      description: 'Prevent setting S3 public-read or public-read-write ACLs.',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Deny",
            Action: ["s3:PutBucketAcl", "s3:PutObjectAcl"],
            Resource: "*",
            Condition: {
              StringEqualsIfExists: {
                "s3:x-amz-acl": ["public-read", "public-read-write"]
              }
            }
          }
        ]
      },
      targetIds: [this.frontendOuId],
    });

    // ========== EBS VOLUME RESTRICTION ==========
    // Limit unencrypted and large (>100GiB) volumes from being created
    new organizations.CfnPolicy(this, 'DenyLargeUnencryptedEbsSCP', {
      name: 'DenyLargeUnencryptedEbs',
      description: 'Deny creating EBS volumes larger than 100GiB or without encryption.',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Deny",
            Action: "ec2:CreateVolume",
            Resource: "*",
            Condition: {
              NumericGreaterThanIfExists: { "ec2:VolumeSize": 100 },
              BoolIfExists: { "ec2:Encrypted": "false" }
            }
          }
        ]
      },
      targetIds: [this.frontendOuId],
    });

    // ========== ALB CREATION GUARDRAIL ==========
    // Require traceability tags on all ALBs and target groups
    new organizations.CfnPolicy(this, 'RestrictALBCreationSCP', {
      name: 'RestrictALBCreation',
      description: 'Require ALBs to have tags for ownership and environment.',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Deny",
            Action: [
              "elasticloadbalancing:CreateLoadBalancer",
              "elasticloadbalancing:CreateTargetGroup"
            ],
            Resource: "*",
            Condition: {
              Null: {
                "aws:RequestTag/Owner": "true",
                "aws:RequestTag/Environment": "true"
              }
            }
          }
        ]
      },
      targetIds: [this.frontendOuId],
    });

    // ========== CLOUDFRONT GUARDRAIL ==========
    // Prevent creating distributions without logging enabled (audit readiness)
    new organizations.CfnPolicy(this, 'DenyCloudFrontWithoutLoggingSCP', {
      name: 'DenyCloudFrontWithoutLogging',
      description: 'Deny CloudFront distribution creation if logging is not enabled.',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Deny",
            Action: ["cloudfront:CreateDistribution", "cloudfront:UpdateDistribution"],
            Resource: "*",
            Condition: {
              BoolIfExists: {
                "cloudfront:LoggingEnabled": "false"
              }
            }
          }
        ]
      },
      targetIds: [this.frontendOuId],
    });

    // ========== BLOCK UNNECESSARY SERVICES FOR FRONTEND ==========
    // Reason: Frontend devs should not provision backend services like databases, queues,
    // or compute options outside the approved architecture. These lead to cost sprawl,
    // inconsistent architecture, and potential security misconfigurations.

    new organizations.CfnPolicy(this, 'DenyUnapprovedServicesSCP', {
      name: 'DenyUnapprovedServices',
      description: 'Denies access to backend or irrelevant services for frontend web developers.',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: 'DenyDatabaseServices',
            Effect: 'Deny',
            Action: [
              "rds:*",
              "dynamodb:*",
              "neptune:*"
            ],
            Resource: "*"
          },
          {
            Sid: 'DenyMessagingServices',
            Effect: 'Deny',
            Action: [
              "sns:*",
              "sqs:*",
              "mq:*"
            ],
            Resource: "*"
          },
          {
            Sid: 'DenyComputeNotInScope',
            Effect: 'Deny',
            Action: [
              "lambda:*",
              "eks:*",
              "ecs:*"
            ],
            Resource: "*"
          },
          {
            Sid: 'DenyDeveloperTooling',
            Effect: 'Deny',
            Action: [
              "cloud9:*",
              "codebuild:*",
              "codedeploy:*",
              "codepipeline:*"
            ],
            Resource: "*"
          }
        ]
      },
      targetIds: [this.frontendOuId],
    });
  }
}
