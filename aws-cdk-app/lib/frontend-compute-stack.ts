// lib/frontend-compute-stack.ts
/**
 * File: frontend-compute-stack.ts
 * Date: 2025-03-27
 * Author: Gaganjit Singh Hattar
 * Description: Provision frontend Compute infrastructure stacks, i.e. ALB, ASG and EC2
 * Change History:
 * -----------------------------------------------------------------------------
 * Date         | Author                 | Description
 * -----------------------------------------------------------------------------
 * 2025-03-27   | Gaganjit Singh Hattar  | Initial creation of CDK app structure
 * 2025-03-27   | Gaganjit Singh Hattar  | Added CLW log group, ALB, ASG, SG, CW metrics
 * 2025-03-27   | Gaganjit Singh Hattar  | Added dynamic CloudFront IP provider
 * -----------------------------------------------------------------------------
 * 
 * © 2025 Gaganjit Singh Hattar. All rights reserved.
 */

// lib/frontend-compute-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as logs from 'aws-cdk-lib/aws-logs';
import { CloudFrontIpProvider } from './cloudfront-ip-provider';
import { Construct } from 'constructs';

export class FrontendComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================
    // SECURITY GROUP for ALB
    // ========================
    const albSG = new ec2.SecurityGroup(this, 'AlbSG', {
      vpc,
      description: 'Allow HTTP/HTTPS to ALB',
      allowAllOutbound: true,
    });

    // Fetch CloudFront IPs dynamically using custom resource
    const cloudfrontIpProvider = new CloudFrontIpProvider(this, 'CloudFrontIpProvider');

    // Add each IP as an ingress rule for ALB to only allow CloudFront traffic
    for (const cidr of cloudfrontIpProvider.cloudfrontIpList) {
      albSG.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(80), `Allow HTTP from ${cidr}`);
      albSG.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(443), `Allow HTTPS from ${cidr}`);
    }

    // ========================
    // CLOUDWATCH LOG GROUP FOR ALB
    // ========================
    const albLogGroup = new logs.LogGroup(this, 'AlbAccessLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================
    // APPLICATION LOAD BALANCER
    // ========================
    const alb = new elbv2.ApplicationLoadBalancer(this, 'FrontendALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Add HTTP listener (Note: you can enable HTTPS by attaching certificate)
    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
    });

    // ========================
    // SECURITY GROUP for EC2
    // ========================
    const ec2SG = new ec2.SecurityGroup(this, 'Ec2SG', {
      vpc,
      description: 'Allow traffic from ALB to EC2',
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(albSG, ec2.Port.tcp(80));

    // ========================
    // CDK PARAMETERS for ASG
    // ========================
    const minCapacity = new cdk.CfnParameter(this, 'MinCapacity', {
      type: 'Number',
      default: 1,
      description: 'Minimum EC2 instances in ASG',
    });

    const maxCapacity = new cdk.CfnParameter(this, 'MaxCapacity', {
      type: 'Number',
      default: 3,
      description: 'Maximum EC2 instances in ASG',
    });

    // ========================
    // AUTO SCALING GROUP
    // ========================
    const asg = new autoscaling.AutoScalingGroup(this, 'FrontendASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      minCapacity: minCapacity.valueAsNumber,
      maxCapacity: maxCapacity.valueAsNumber,
      desiredCapacity: 1,
      securityGroup: ec2SG,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // ========================
    // CLOUDWATCH METRICS (Built-in)
    // ========================
    // Auto Scaling Group and EC2 instances automatically publish basic CloudWatch metrics
    // such as CPUUtilization, NetworkIn, NetworkOut, etc. To collect detailed metrics or logs,
    // install CloudWatch Agent via userData or SSM later if needed.

    // ========================
    // ATTACH ASG TO ALB
    // ========================
    listener.addTargets('AppTargets', {
      port: 80,
      targets: [asg],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });
  }
}
