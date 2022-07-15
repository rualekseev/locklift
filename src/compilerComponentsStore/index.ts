import path from "path";
import axios from "axios";
import fs from "fs-extra";
import { ungzip } from "node-gzip";

import { getPathToVersion, isComponentVersionExists } from "./dirUtils";
import { downloadLinks, executableFileName, fileNames, getGzFileName, getSupportedVersions } from "./utils";
import { ComponentType } from "./constants";

export const getComponent = async ({
  version,
  component,
}: {
  component: ComponentType;
  version: string;
}): Promise<string> => {
  const tempFileBaseDir = getPathToVersion({ component, version });

  const binaryFilePath = path.join(tempFileBaseDir, executableFileName[component]({ version }));
  if (isComponentVersionExists({ version, component })) {
    return binaryFilePath;
  }

  console.log(`Start downloading ${component} version ${version}`);
  const downloadLink = downloadLinks[component]({ version });

  await fs.ensureDir(tempFileBaseDir);
  const gzFilePath = path.join(tempFileBaseDir, getGzFileName(fileNames[component]({ version })));

  await download(downloadLink, gzFilePath).catch(async () => {
    const supportedVersions = await getSupportedVersions({ component });
    throw new Error(
      `Can't download ${component} version ${version}, supported versions: ${supportedVersions.map(el => ` ${el}`)}`,
    );
  });

  const unzippedBuffer = await ungzip(fs.readFileSync(gzFilePath));
  fs.rmSync(gzFilePath);
  fs.writeFileSync(binaryFilePath, unzippedBuffer);
  fs.chmodSync(binaryFilePath, "755");
  console.log(`${component} version ${version} successfully downloaded`);

  return binaryFilePath;
};

export async function download(fileUrl: string, outputLocationPath: string) {
  const writer = fs.createWriteStream(outputLocationPath);

  return axios({
    method: "get",
    url: fileUrl,
    responseType: "stream",
  })
    .then(response => {
      return new Promise((resolve, reject) => {
        response.data.pipe(writer);

        let error: Error | null;
        writer.on("error", err => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on("close", () => {
          if (!error) {
            resolve(true);
          }
        });
      });
    })
    .catch(e => {
      console.error("AAAAAA", e);
    });
}
