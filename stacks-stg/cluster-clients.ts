import { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';
import { AzurermProvider } from '@cdktf/provider-azurerm/lib/provider';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group';
import { Subnet } from '@cdktf/provider-azurerm/lib/subnet';
import { VirtualNetwork } from '@cdktf/provider-azurerm/lib/virtual-network';

import { getVMList, getLatestImage, getSSHPublicKeysListArray } from '../utils';
import { CLUSTER_DATA_CENTER, CLUSTER_CURRENT_VERSION } from './../config/env';
import { createAzureRBACServicePrincipal } from '../config/service_principal';
import { getCloudInitData } from '../config/cloud-init';
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
      location: CLUSTER_DATA_CENTER
    });

    const vnetIdentifier = `${env}-vnet-${name}`;
    const vnet = new VirtualNetwork(this, vnetIdentifier, {
      dependsOn: [rg],
      name: vnetIdentifier,
      resourceGroupName: rg.name,
      location: rg.location,
      addressSpace: ['10.1.0.0/16']
    });

    const subnetIdentifier = `${env}-subnet-${name}`;
    const subnet = new Subnet(this, subnetIdentifier, {
      dependsOn: [vnet],
      name: subnetIdentifier,
      resourceGroupName: rg.name,
      virtualNetworkName: vnet.name,
      addressPrefixes: ['10.1.0.0/24']
    });

    const disabled = false; // Change this to quickly delete only the VMs
    if (!disabled) {
      const numberOfVMs = 3;
      const prefix = '10.1.0.';
      const suffix = 200;

      // This will cycle the VMs through the year.
      const startIndex = new Date().getUTCMonth() + CLUSTER_CURRENT_VERSION;

      const customImageId = getLatestImage('Nomad', CLUSTER_DATA_CENTER)?.id;
      const typeTag = `${env}-nomad-client`;
      const clientList = getVMList({
        vmPrefix: 'clt-',
        typeTag,
        numberOfVMs,
        prefix,
        suffix,
        startIndex
      });

      clientList.forEach(({ name: clientName, privateIP }) => {
        const customData = getCloudInitData();
        createVirtualMachine(this, {
          allocatePublicIP: true,
          createBeforeDestroy: true,
          customData,
          customImageId,
          env: env,
          privateIP,
          rg: rg,
          sshPublicKeys: getSSHPublicKeysListArray(),
          stackName: name,
          subnet: subnet,
          typeTag,
          vmName: clientName
        });
      });
    }

    // End of stack
  }
}
