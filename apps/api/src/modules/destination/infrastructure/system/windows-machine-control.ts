import { exec } from "child_process";
import { Injectable, Logger } from "@nestjs/common";
import type { MachineControlPort } from "../../application/ports/machine-control.port";

/**
 * Tat may Windows that qua lenh `shutdown` — xem doc comment o port de biet
 * dieu kien duoc phep goi. Delay 60s truoc khi tat de kip ghi log/gui thong
 * bao; `shutdown /a` (huy) van chay duoc trong 60s do neu can can thiep tay.
 */
@Injectable()
export class WindowsMachineControl implements MachineControlPort {
  private readonly logger = new Logger(WindowsMachineControl.name);

  async shutdown(reason: string): Promise<void> {
    if (process.platform !== "win32") {
      this.logger.error(`Yeu cau tat may nhung khong phai Windows (platform=${process.platform}) — bo qua. Ly do: ${reason}`);
      return;
    }
    this.logger.error(`TAT MAY sau 60s — ly do: ${reason}. Chay "shutdown /a" de huy neu can.`);
    exec('shutdown /s /t 60 /c "ZinoFlow: batch geocode bi Google chan lien tuc, tu dong tat may theo yeu cau"', (err) => {
      if (err) this.logger.error(`Lenh shutdown loi: ${err.message}`);
    });
  }
}
