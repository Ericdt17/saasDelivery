/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface HrE2EApi {
  injectFace?: (descriptor?: number[]) => void;
  setGeo?: (lat: number, lng: number) => void;
}

interface Window {
  __HR_E2E__?: HrE2EApi;
}
