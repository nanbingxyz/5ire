!macro customInstall
  DeleteRegKey HKCR "app5ire"
  WriteRegStr HKCR "app5ire" "" "URL:app5ire"
  WriteRegStr HKCR "app5ire" "URL Protocol" ""
  WriteRegStr HKCR "app5ire\shell" "" ""
  WriteRegStr HKCR "app5ire\shell\Open" "" ""
  WriteRegStr HKCR "app5ire\shell\Open\command" "" "$INSTDIR\{APP_EXECUTABLE_FILENAME} %1"
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "app5ire"
!macroend

# Fix Can not find Squairrel error
# https://github.com/electron-userland/electron-builder/issues/837#issuecomment-355698368
!macro customInit
  nsExec::Exec '"$LOCALAPPDATA\5ire\Update.exe" --uninstall -s'
!macroend
