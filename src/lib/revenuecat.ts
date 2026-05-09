import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { Tier } from '../hooks/useSubscription';

const RC_KEY_IOS     = process.env.EXPO_PUBLIC_RC_KEY_IOS     ?? '';
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_KEY_ANDROID ?? '';

// Call once at app startup (before any purchase calls).
// No-ops if the env key is missing so the app still runs during development
// before RevenueCat credentials are set.
export function initRevenueCat(): void {
  const apiKey = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;
  if (!apiKey) {
    if (__DEV__) console.warn('[RC] EXPO_PUBLIC_RC_KEY not set — RevenueCat disabled');
    return;
  }
  if (!__DEV__ && apiKey.startsWith('test_')) {
    console.error('[RC] Test key used in production build — replace with live key before App Store submission');
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
}

// Map active RC entitlements → app tier.
export function tierFromCustomerInfo(info: CustomerInfo): Tier {
  const active = info.entitlements.active;
  if (active['operator']) return 'operator';
  if (active['builder'])  return 'builder';
  return 'explorer';
}

// Fetch the package matching the billing period from the current offering.
// RC dashboard default offering uses standard identifiers: $rc_monthly, $rc_annual
export async function getPackageForTier(
  _tier: Tier,
  isAnnual: boolean,
): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const pkgId = isAnnual ? '$rc_annual' : '$rc_monthly';
  return (
    offerings.current?.availablePackages.find(p => p.identifier === pkgId) ?? null
  );
}

// Returns current customer info without triggering a purchase.
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

// Purchase a plan package and return the resulting CustomerInfo.
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

// Restore prior purchases and return the resulting CustomerInfo.
export async function restoreRC(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}
