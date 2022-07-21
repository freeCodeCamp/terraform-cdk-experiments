import { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';
import {
  AzurermProvider,
  ResourceGroup,
  Subnet,
  VirtualNetwork
} from '@cdktf/provider-azurerm';

import { getVMList, getLatestImage, getSSHPublicKeysListArray } from '../utils';
import { createAzureRBACServicePrincipal } from '../config/service_principal';
import { getCloudInitForNomadClient } from '../config/nomad/cloud-init';
import { StackConfigOptions } from '../components/remote-backend/index';
import { createVirtualMachine } from '../components/virtual-machine';

export default class stgClusterClientStack extends TerraformStack {
  constructor(
    scope: Construct,
    tfConstructName: string,
    config: StackConfigOptions
  ) {
    super(scope, tfConstructName);

    const { env, name } = config;

    const { subscriptionId, tenantId, clientId, clientSecret } =
      createAzureRBACServicePrincipal(this);

    new AzurermProvider(this, 'azurerm', {
      features: {},
      subscriptionId: subscriptionId.stringValue,
      tenantId: tenantId.stringValue,
      clientId: clientId.stringValue,
      clientSecret: clientSecret.stringValue
    });

    const rgIdentifier = `${env}-rg-${name}`;
    const rg = new ResourceGroup(this, rgIdentifier, {
      name: rgIdentifier,
      location: 'eastus'
    });

    const vnetIdentifier = `${env}-vnet-${name}`;
    const vnet = new VirtualNetwork(this, vnetIdentifier, {
      name: vnetIdentifier,
      resourceGroupName: rg.name,
      location: rg.location,
      addressSpace: ['10.1.0.0/16']
    });

    const subnetIdentifier = `${env}-subnet-${name}`;
    const subnet = new Subnet(this, subnetIdentifier, {
      name: subnetIdentifier,
      resourceGroupName: rg.name,
      virtualNetworkName: vnet.name,
      addressPrefixes: ['10.1.0.0/24']
    });

    const numberOfVMs = 5;
    const prefix = '10.1.0.';
    const suffix = 200;

    // This will cycle the VMs through the year.
    const startIndex = new Date().getUTCMonth() + 1; // Add 1 because January is 0.

    const customImageId = getLatestImage('NomadConsul', 'eastus').id;
    const vmTypeTag = `${env}-nomad-client`;
    const clientList = getVMList({
      vmTypeTag,
      numberOfVMs,
      prefix,
      suffix,
      startIndex
    });
    const customData = getCloudInitForNomadClient();

    clientList.forEach(({ name: clientName, privateIP }) => {
      createVirtualMachine(this, {
        stackName: name,
        vmName: `clt-${clientName}`,
        rg: rg,
        env: env,
        subnet: subnet,
        privateIP,
        sshPublicKeys: getSSHPublicKeysListArray(),
        customImageId,
        vmTypeTag,
        customData,
        allocatePublicIP: false,
        createBeforeDestroy: true
      });
    });

    // End of stack
  }
}
