namespace Kuryon.API.Models;

public static class CourierStatusValues
{
    public const string Online = "online";
    public const string Offline = "offline";
    public const string Break = "break";

    public static bool IsValid(string status)
    {
        return status is Online or Offline or Break;
    }
}
