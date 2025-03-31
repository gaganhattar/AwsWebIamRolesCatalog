#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FrontendServiceCatalogStack } from '../lib/frontend-servicecatalog';
import { VpcNetworkStack } from '../lib/vpc-network-stack';
import { FrontendScpPoliciesStack } from '../lib/frontend-scp-policies';
import { FrontendIamRolesStack } from '../lib/frontend-iam-roles';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
};


/** Foundational Steps provisioning vps, Devteam OU, Devteam Account, SCP, IAM roles */
// **Caution**: This Stack assume no foundation infrsature is deployed and no VPC/networkin is already present in the account.
// we are creating VPC with CIDR = 10.0.0.0/16, in any case, if you have existing VPC, please update the CIDR accordingly.    
// 1. Create the VPC and networking resources
const vpcStack = new VpcNetworkStack(app, 'VpcNetworkStack', { env });

// 2. Creates OU and SCP to restrict access to the VPC 
new FrontendScpPoliciesStack(app, 'FrontendScpPoliciesStack');

// 3. IAM roles for frontend team to interact with Service Catalog and S3
//  new FrontendIamRolesStack (this, 'FrontendIamRolesStack'); //called in app.ts for arns

// Deploy IAM Roles first
const iamStack = new FrontendIamRolesStack(app, 'FrontendIamRolesStack', { env });

// Pass role ARNs to Service Catalog stack
new FrontendServiceCatalogStack(app, 'FrontendServiceCatalogStack', {
  env,
  launchRoleArn: iamStack.launchRole.roleArn,
  endUserRoleArn: iamStack.devEndUserRole.roleArn
});
