param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Threading;
public static class ImmunoStudioVectorClipboard {
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern IntPtr CreateWindowExW(uint exStyle,string cls,string name,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
  [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr hwnd);
  [DllImport("user32.dll", SetLastError=true)] static extern bool OpenClipboard(IntPtr owner);
  [DllImport("user32.dll")] static extern bool CloseClipboard();
  [DllImport("user32.dll", SetLastError=true)] static extern bool EmptyClipboard();
  [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetClipboardData(uint format,IntPtr data);
  [DllImport("gdi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr GetEnhMetaFileW(string file);
  [DllImport("gdi32.dll")] static extern bool DeleteEnhMetaFile(IntPtr data);
  public static void Copy(string file) {
    IntPtr emf=GetEnhMetaFileW(file);
    if(emf==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    IntPtr owner=CreateWindowExW(0,"STATIC","ImmunoStudio clipboard",0,0,0,0,0,new IntPtr(-3),IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
    bool opened=false,transferred=false;
    try {
      if(owner==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      for(int i=0;i<15;i++) {if(OpenClipboard(owner)){opened=true;break;}Thread.Sleep(40);}
      if(!opened) throw new InvalidOperationException("Clipboard is busy. Try again.");
      if(!EmptyClipboard()) throw new Win32Exception(Marshal.GetLastWin32Error());
      if(SetClipboardData(14,emf)==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      transferred=true; // Windows owns the enhanced-metafile handle now.
    } finally {
      if(opened) CloseClipboard();
      if(!transferred) DeleteEnhMetaFile(emf);
      if(owner!=IntPtr.Zero) DestroyWindow(owner);
    }
  }
}
'@
[ImmunoStudioVectorClipboard]::Copy((Resolve-Path -LiteralPath $Path).Path)
Write-Output 'EMF copied'
