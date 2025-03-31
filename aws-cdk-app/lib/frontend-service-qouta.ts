// lib/frontend-service-quotas-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

//install this lib (not in deafult cdk lib)
import * as servicequotas from 'aws-cdk-lib/aws-servicequotas'; 

export class FrontendServiceQuotasStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Example: Limit EC2 On-Demand instances to 5 in this region.
    // This prevents the dev account from spinning up more than 5 EC2 instances simultaneously.
    new servicequotas.CfnServiceQuota(this, 'EC2InstanceQuota', {
      serviceCode: 'ec2',
      quotaCode: 'L-1216C47A', // Running On-Demand Standard Instances
      value: 5, // Max number of EC2 instances allowed in this region
    });

    // Example: Limit the number of S3 buckets that can be created in this AWS account.
    // AWS by default allows up to 100 buckets per account.
    // We override this to 10 to enforce tighter governance for frontend workloads.
    new servicequotas.CfnServiceQuota(this, 'S3BucketQuota', {
      serviceCode: 's3',
      quotaCode: 'L-DC2B2D3D', // Buckets per AWS account
      value: 10, // Limit number of S3 buckets in this account to 10
    });
  }
}

// lib/frontend-budgets-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as budgets from 'aws-cdk-lib/aws-budgets';

export class FrontendBudgetsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps & { budgetEmail: string }) {
    super(scope, id, props);
   
    // CDK parameter to inject recipient email for budget alert
   //  const budgetEmail = new cdk.CfnParameter(this, 'BudgetEmail', {
   //    type: 'String',
   //    description: 'Email to notify when budget threshold is exceeded',
   //  });

    // Budget alert of $50 monthly spend for this account.
    // Triggers notification when 80% of budget is reached.
    new budgets.CfnBudget(this, 'FrontendMonthlyBudget', {
      budget: {
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: 50, // Max allowed spend per month in USD
          unit: 'USD'
        },
        budgetName: 'FrontendMonthlyBudget'
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: 'GREATER_THAN',
            threshold: 80, // Trigger alert at 80% usage
            thresholdType: 'PERCENTAGE',
            notificationType: 'ACTUAL'
          },
          subscribers: [
            {
              subscriptionType: 'EMAIL',
              address: props.budgetEmail // Dynamically injected email from CLI or context
            }
          ]
        }
      ]
    });
  }
}
