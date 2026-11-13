using System.Security.AccessControl;
using System.Security.Principal;

namespace Memoryaffe.Infrastructure;
public static class PrivateStorage
{
    public static void Directory(string path)
    {
        System.IO.Directory.CreateDirectory(path);
        if (OperatingSystem.IsWindows())
        {
            var acl = new DirectorySecurity(); acl.SetAccessRuleProtection(true, false); var sid = WindowsIdentity.GetCurrent().User!;
            acl.SetOwner(sid); acl.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow)); new DirectoryInfo(path).SetAccessControl(acl);
        }
        else File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    }
}
