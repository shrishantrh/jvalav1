// Type augmentation for Push API (not included in default DOM lib)
interface PushSubscriptionOptionsInit {
  userVisibleOnly?: boolean;
  applicationServerKey?: BufferSource | string | null;
}

interface PushSubscription {
  readonly endpoint: string;
  readonly options: PushSubscriptionOptionsInit;
  getKey(name: string): ArrayBuffer | null;
  toJSON(): Record<string, unknown>;
  unsubscribe(): Promise<boolean>;
}

interface PushManager {
  getSubscription(): Promise<PushSubscription | null>;
  subscribe(options?: PushSubscriptionOptionsInit): Promise<PushSubscription>;
}

interface ServiceWorkerRegistration {
  readonly pushManager: PushManager;
}
