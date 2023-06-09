import { readFileSync } from 'fs';
import { join } from 'path';
import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator';

//
// Working with SSH Public Keys
//
export const getSSHPublicKeysListArray = (): Array<string> => {
  const sshPublicKeys: Array<string> = [];
  importSSHPublicKeyMembers().map((member: { publicKeys: [string] }) => {
    member?.publicKeys?.forEach((key: string) => {
      sshPublicKeys.push(key);
    });
  });
  return sshPublicKeys;
};
export const importSSHPublicKeyMembers = () => {
  try {
    const members = JSON.parse(
      readFileSync(
        join(__dirname, '../scripts/data/github-members.json'),
        'utf8'
      )
    );
    if (members.length < 1) {
      throw new Error('No members found in the github-members file');
    }
    return members;
  } catch (error) {
    throw new Error(`

    Error:
    No members found in the github-members file, or the file does not exist.
    Please run the prebuild scripts to generate the data.

    `);
  }
};

//
// Working with Machine Images
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const groupBy = (list: Array<any>, key: string) => {
  return list.reduce((prev, current) => {
    (prev[current[key]] = prev[current[key]] || []).push(current);
    return prev;
  }, {});
};
export const importMachineImages = () => {
  try {
    const images = JSON.parse(
      readFileSync(
        join(__dirname, '../scripts/data/machine-images.json'),
        'utf8'
      )
    );
    if (images.length < 1) {
      throw new Error('No images found in the machine-images file');
    }
    return images;
  } catch (error) {
    throw new Error(`

    Error:
    No machine images found in the machine-images file, or the file does not exist.
    Please run the prebuild scripts to generate the data.

    `);
  }
};
export const getMachineImages = (imageType = '') => {
  const availableImages = importMachineImages().map(
    ({
      id,
      name,
      location,
      tags
    }: {
      id: string;
      name: string;
      location: string;
      tags: { [key: string]: string };
    }) => ({
      id,
      name,
      location,
      imageType: tags['ops-image-type']
    })
  );

  return imageType !== ''
    ? groupBy(availableImages, 'imageType')[imageType]
    : groupBy(availableImages, 'imageType');
};

type MachineImage = {
  id: string;
  name: string;
  location: string;
  imageType: string;
};
export const getLatestImage = (imageType: string, location: string) => {
  try {
    const requestedImageList: [MachineImage] = getMachineImages(imageType);
    const filteredImageList = requestedImageList.filter(
      (image: MachineImage) => image.location === location
    );
    const latestImage = filteredImageList.sort(
      // localeCompare returns -1, 0, 1 if a is 'before' b, t
      (a: MachineImage, b: MachineImage) => -1 * a.name.localeCompare(b.name)
    )[0];
    if (!latestImage) {
      throw new Error();
    }
    console.log(
      `Latest image for ${imageType} in ${location} is ${latestImage}`
    );
    return latestImage;
  } catch (error) {
    throw new Error(`

    Error:
    The requested image type "${imageType}" does not exist OR the machine-images file is empty.

    `);
  }
};

//
// Working with VM Lists
//
export type VMList = {
  name: string;
  privateIP: string;
};
// If numberOfVMs = 5 & suffix = 20 VM IPs like 10.0.0.21-10.0.0.25 and so on
// Adjust the startIndex to churn through the IPs
export const getVMList = ({
  vmPrefix = 'tst',
  typeTag,
  numberOfVMs,
  prefix = '10.0.0.',
  suffix = 10,
  startIndex = 1
}: {
  vmPrefix?: string;
  typeTag: string;
  numberOfVMs: number;
  prefix?: string;
  suffix?: number;
  startIndex?: number;
}): Array<VMList> => {
  const machinesList = [];
  for (let i = startIndex; i < startIndex + numberOfVMs; i++) {
    const name = `${vmPrefix}${uniqueNamesGenerator({
      dictionaries: [colors, animals],
      length: 2,
      separator: '-',
      style: 'lowerCase',
      seed: typeTag + i // Create a unique but deterministic name for a VM
    })}`;
    machinesList.push({
      name,
      privateIP: `${prefix}${suffix + i}`
    });
  }
  console.log(`Generating a list of ${numberOfVMs} VMs with the following properties:
${JSON.stringify(machinesList, null, 2)}
  `);
  return machinesList;
};
