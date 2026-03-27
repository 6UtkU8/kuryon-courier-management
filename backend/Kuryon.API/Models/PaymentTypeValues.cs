namespace Kuryon.API.Models;

public static class PaymentTypeValues
{
    public const string Cash = "cash";
    public const string Card = "card";
    public const string Online = "online";

    public static string Normalize(string? paymentType)
    {
        return (paymentType ?? string.Empty).Trim().ToLowerInvariant();
    }

    public static bool IsValid(string paymentType)
    {
        return paymentType is Cash or Card or Online;
    }
}
