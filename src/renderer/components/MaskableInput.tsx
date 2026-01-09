import { Button, Input } from "@fluentui/react-components";
import { Eye20Filled, EyeOff20Filled } from "@fluentui/react-icons";
import { forwardRef, useState } from "react";

function MaskableInput(props: any, ref: any) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <Input
      {...props}
      type={showRaw ? "text" : "password"}
      contentAfter={
        showRaw ? (
          <Button size="small" icon={<EyeOff20Filled />} appearance="subtle" onClick={() => setShowRaw(false)} />
        ) : (
          <Button size="small" icon={<Eye20Filled />} appearance="subtle" onClick={() => setShowRaw(true)} />
        )
      }
      ref={ref}
    />
  );
}

export default forwardRef(MaskableInput);
