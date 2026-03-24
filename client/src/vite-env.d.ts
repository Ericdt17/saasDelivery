/// <reference types="vite/client" />

/**
 * Environment Variables Type Definitions
 * These types ensure TypeScript knows about our custom environment variables
 */
interface ImportMetaEnv {
  /**
   * API Base URL
   * - In development: Leave empty to use Vite proxy, or set to http://localhost:3000
   * - In production: Set to your production API URL
   * @example http://localhost:3000
   * @example https://api.example.com
   */
  readonly VITE_API_BASE_URL?: string;

  /** Email support (autres usages) */
  readonly VITE_SUPPORT_EMAIL?: string;

  /** URL WhatsApp pour « Nous contacter » sur les pages d’erreur (défaut : wa.link du projet) */
  readonly VITE_WHATSAPP_CONTACT_URL?: string;

  /**
   * Application mode
   * Automatically set by Vite based on the mode flag
   * @example development
   * @example production
   */
  readonly MODE: string;

  /**
   * Whether the app is running in development mode
   */
  readonly DEV: boolean;

  /**
   * Whether the app is running in production mode
   */
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
