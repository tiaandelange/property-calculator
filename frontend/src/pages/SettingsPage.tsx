import { Helmet } from "react-helmet-async";
import { SettingsDashboard } from "../features/settings/SettingsDashboard";

export function SettingsPage() {
  return (
    <>
      <Helmet>
        <title>Settings | Proplytic</title>
      </Helmet>
      <SettingsDashboard />
    </>
  );
}
