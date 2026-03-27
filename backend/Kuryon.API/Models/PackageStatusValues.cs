namespace Kuryon.API.Models;

public static class PackageStatusValues
{
    public const string Created = "created";
    public const string Assigned = "assigned";
    public const string PickedUp = "picked_up";
    public const string OutForDelivery = "out_for_delivery";
    public const string Delivered = "delivered";
    public const string Failed = "failed";
    public const string Cancelled = "cancelled";

    public static string Normalize(string? status)
    {
        return (status ?? string.Empty).Trim().ToLowerInvariant();
    }

    public static bool IsValid(string status)
    {
        return status is Created or Assigned or PickedUp or OutForDelivery or Delivered or Failed or Cancelled;
    }
}
