declare const ASSET_VERSIONS: Readonly<Record<string, string>> | undefined;

export const assetUrl = (path: string): string => {
  const version =
    typeof ASSET_VERSIONS === "undefined" ? undefined : ASSET_VERSIONS[path];
  return version ? `${path}?v=${version}` : path;
};
