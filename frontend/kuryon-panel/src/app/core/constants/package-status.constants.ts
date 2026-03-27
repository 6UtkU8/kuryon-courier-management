export type PackageApiStatus =
  | 'created'
  | 'assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export const PACKAGE_API_STATUS = {
  created: 'created' as PackageApiStatus,
  assigned: 'assigned' as PackageApiStatus,
  pickedUp: 'picked_up' as PackageApiStatus,
  outForDelivery: 'out_for_delivery' as PackageApiStatus,
  delivered: 'delivered' as PackageApiStatus,
  failed: 'failed' as PackageApiStatus,
  cancelled: 'cancelled' as PackageApiStatus
};
