import type { ConfigContext, ExpoConfig } from "expo/config";

function allowCleartext(): boolean {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile === "production" || profile === "preview") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const cleartext = allowCleartext();
  const ios = config.ios ?? {};
  const infoPlist = { ...(ios.infoPlist ?? {}) };
  if (cleartext) {
    infoPlist.NSAppTransportSecurity = { NSAllowsLocalNetworking: true };
  } else if (infoPlist.NSAppTransportSecurity && typeof infoPlist.NSAppTransportSecurity === "object") {
    const ats = { ...(infoPlist.NSAppTransportSecurity as Record<string, unknown>) };
    delete ats.NSAllowsLocalNetworking;
    infoPlist.NSAppTransportSecurity = ats;
  }
  const android = Object.assign({}, config.android, { usesCleartextTraffic: cleartext });
  return {
    ...config,
    name: config.name ?? "2books",
    slug: config.slug ?? "2books",
    ios: { ...ios, infoPlist },
    android,
  };
};
