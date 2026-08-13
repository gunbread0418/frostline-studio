using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;

namespace FrostlineStudio.CodexLauncher
{
    internal static class Program
    {
        private const int ErrorSuccess = 0;
        private const int ErrorInsufficientBuffer = 122;
        private const int AppModelErrorNoApplication = 15703;
        private const int AfInet = 2;
        private const int TcpTableOwnerPidListener = 3;
        private const uint ProcessQueryLimitedInformation = 0x1000;

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint access, bool inheritHandle, int processId);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr handle);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetApplicationUserModelId(
            IntPtr process,
            ref uint applicationUserModelIdLength,
            StringBuilder applicationUserModelId);

        [DllImport("iphlpapi.dll", SetLastError = true)]
        private static extern uint GetExtendedTcpTable(
            IntPtr tcpTable,
            ref int size,
            bool order,
            int ipVersion,
            int tableClass,
            uint reserved);

        [ComImport]
        [Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IApplicationActivationManager
        {
            [PreserveSig]
            int ActivateApplication(
                [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
                [MarshalAs(UnmanagedType.LPWStr)] string arguments,
                int options,
                out uint processId);
        }

        [ComImport]
        [Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
        private class ApplicationActivationManager { }

        private static int Main(string[] args)
        {
            string stage = "startup";
            try
            {
                stage = "parse";
                string action = ReadArgument(args, "--action");
                if (action == "inspect")
                {
                    Inspect();
                }
                else if (action == "launch")
                {
                    Launch(ReadArgument(args, "--aumid"), ReadPort(args));
                }
                else if (action == "owner")
                {
                    ReportOwner(ReadPort(args));
                }
                else
                {
                    throw new InvalidOperationException("invalid-action");
                }
                return 0;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(SafeErrorCode(error, stage));
                return 1;
            }
        }

        private static void Inspect()
        {
            HashSet<string> identities = new HashSet<string>(StringComparer.Ordinal);
            foreach (Process process in Process.GetProcessesByName("ChatGPT"))
            {
                string identity = TryGetAumid(process.Id);
                if (!String.IsNullOrEmpty(identity) && identity.StartsWith("OpenAI.Codex_", StringComparison.Ordinal))
                {
                    identities.Add(identity);
                }
            }
            if (identities.Count > 1)
            {
                throw new InvalidOperationException("ambiguous-codex-identity");
            }
            string aumid = identities.SingleOrDefault();
            WriteJson(aumid == null
                ? "{\"running\":false,\"aumid\":null}"
                : "{\"running\":true,\"aumid\":\"" + aumid + "\"}");
        }

        private static void Launch(string encodedAumid, int port)
        {
            if (Process.GetProcessesByName("ChatGPT").Any(process =>
                (TryGetAumid(process.Id) ?? "").StartsWith("OpenAI.Codex_", StringComparison.Ordinal)))
            {
                throw new InvalidOperationException("codex-already-running");
            }
            string aumid;
            try
            {
                aumid = Encoding.UTF8.GetString(Convert.FromBase64String(encodedAumid ?? ""));
            }
            catch
            {
                throw new InvalidOperationException("invalid-aumid");
            }
            if (!IsValidAumid(aumid)) throw new InvalidOperationException("invalid-aumid");

            IApplicationActivationManager manager =
                (IApplicationActivationManager)new ApplicationActivationManager();
            uint processId;
            string arguments = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=" + port;
            int result = manager.ActivateApplication(aumid, arguments, 2, out processId);
            if (result != ErrorSuccess || processId == 0)
            {
                throw new InvalidOperationException("activation-failed");
            }
            WriteJson("{\"activationPid\":" + processId + "}");
        }

        private static void ReportOwner(int port)
        {
            int ownerPid = FindListeningProcess(port);
            if (ownerPid <= 0) throw new InvalidOperationException("port-owner-not-found");
            string aumid = TryGetAumid(ownerPid);
            if (String.IsNullOrEmpty(aumid) || !aumid.StartsWith("OpenAI.Codex_", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("port-owner-not-packaged");
            }
            WriteJson("{\"ownerPid\":" + ownerPid + ",\"aumid\":\"" + aumid + "\"}");
        }

        private static int FindListeningProcess(int port)
        {
            int size = 0;
            uint result = GetExtendedTcpTable(
                IntPtr.Zero, ref size, true, AfInet, TcpTableOwnerPidListener, 0);
            if (result != ErrorInsufficientBuffer || size <= 4) return 0;
            IntPtr table = Marshal.AllocHGlobal(size);
            try
            {
                result = GetExtendedTcpTable(
                    table, ref size, true, AfInet, TcpTableOwnerPidListener, 0);
                if (result != ErrorSuccess) return 0;
                int count = Marshal.ReadInt32(table);
                int rowSize = 24;
                for (int index = 0; index < count; index++)
                {
                    IntPtr row = IntPtr.Add(table, 4 + (index * rowSize));
                    uint networkPort = unchecked((uint)Marshal.ReadInt32(row, 8));
                    int hostPort = unchecked((ushort)IPAddress.NetworkToHostOrder((short)networkPort));
                    if (hostPort == port) return Marshal.ReadInt32(row, 20);
                }
                return 0;
            }
            finally
            {
                Marshal.FreeHGlobal(table);
            }
        }

        private static string TryGetAumid(int processId)
        {
            IntPtr handle = OpenProcess(ProcessQueryLimitedInformation, false, processId);
            if (handle == IntPtr.Zero) return null;
            try
            {
                uint length = 0;
                int result = GetApplicationUserModelId(handle, ref length, null);
                if (result == AppModelErrorNoApplication) return null;
                if (result != ErrorInsufficientBuffer || length == 0 || length > 512) return null;
                StringBuilder builder = new StringBuilder((int)length);
                result = GetApplicationUserModelId(handle, ref length, builder);
                if (result != ErrorSuccess) return null;
                string value = builder.ToString();
                return IsValidAumid(value) ? value : null;
            }
            finally
            {
                CloseHandle(handle);
            }
        }

        private static int ReadPort(IEnumerable<string> args)
        {
            int port;
            if (!Int32.TryParse(ReadArgument(args, "--port"), out port) || port < 1024 || port > 65535)
            {
                throw new InvalidOperationException("invalid-port");
            }
            return port;
        }

        private static string ReadArgument(IEnumerable<string> args, string name)
        {
            string prefix = name + "=";
            string value = args.FirstOrDefault(argument => argument.StartsWith(prefix, StringComparison.Ordinal));
            return value == null ? null : value.Substring(prefix.Length);
        }

        private static bool IsValidAumid(string value)
        {
            if (String.IsNullOrEmpty(value) || value.Length > 261) return false;
            int separator = value.IndexOf('!');
            if (separator <= 0 || separator != value.LastIndexOf('!') || separator == value.Length - 1) return false;
            foreach (char character in value)
            {
                if (!(Char.IsLetterOrDigit(character) || character == '.' || character == '_' ||
                    character == '-' || character == '!')) return false;
            }
            return true;
        }

        private static void WriteJson(string json)
        {
            Console.Out.Write(Convert.ToBase64String(Encoding.UTF8.GetBytes(json)));
        }

        private static string SafeErrorCode(Exception error, string stage)
        {
            string[] allowed =
            {
                "invalid-action",
                "invalid-aumid",
                "invalid-port",
                "ambiguous-codex-identity",
                "codex-already-running",
                "port-owner-not-found",
                "port-owner-not-packaged",
                "activation-failed"
            };
            return allowed.Contains(error.Message)
                ? error.Message
                : "helper-failed-" + stage + "-" + error.GetType().Name;
        }
    }
}
