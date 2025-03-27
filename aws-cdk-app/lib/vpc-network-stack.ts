// lib/vpc-network-stack.ts
// Defines a VPC with public/private subnets and NACLs for frontend infrastructure
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a new VPC with 2 availability zones and defined subnet configurations
    this.vpc = new ec2.Vpc(this, 'FrontendVPC', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      // Define subnet configuration: one public and one private per AZ
      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
      natGateways: 1 // Allow internet access from private subnets via NAT
    });

    // Create a custom Network ACL and associate it with public subnets
    const nacl = new ec2.NetworkAcl(this, 'FrontendNACL', {
      vpc: this.vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC }
    });

      nacl.addEntry('AllowHTTP', {
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(), // Allow HTTP traffic from anywhere
      ruleAction: ec2.Action.ALLOW,
      traffic: ec2.AclTraffic.tcpPort(80),
    });

      nacl.addEntry('AllowHTTPS', {
      ruleNumber: 110,
      cidr: ec2.AclCidr.anyIpv4(), // Allow HTTPS traffic from anywhere
      ruleAction: ec2.Action.ALLOW,
      traffic: ec2.AclTraffic.tcpPort(443),
    });
  }
}