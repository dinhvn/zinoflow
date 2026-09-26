# Workspace cha + git submodule cho các repo MMO (CHƯA LÀM — làm trên Mac)

Ghi 26/09/2026. Người dùng muốn 1 "workspace cha" chứa doc và những thứ dùng chung,
các repo ứng dụng (zinoflow, dichoithoi, khuyenmai...) là **git submodule** bên trong.
Người dùng chọn làm **trên Mac, sau khi chuyển máy xong** (sau khi khôi phục theo
`migration-mac-2026-09-26/HUONG-DAN-KHOI-PHUC-TREN-MAC.md`).

## Hiện trạng (audit 26/09/2026)

- `D:\Gits\mmo` là thư mục thường (không phải git), chứa các repo ngang hàng:

  | Repo | Remote | Nhánh |
  |---|---|---|
  | zinoflow | GitHub `dinhvn/zinoflow` | main |
  | zinora | GitHub `dinhvn/zinora` | main |
  | dichoithoi | Azure DevOps `MMO/_git/dichoithoi` | develop |
  | khuyenmai | Azure DevOps `MMO/_git/khuyenmai` | develop |
  | wordpress-theme, mmo-chrome-extension, protool | Azure DevOps `MMO/_git/*` | develop |
  | Trading | Azure DevOps `Trading/_git/Trading` | develop |
  | dino-bee | (không phải git) | |

- `mmo.code-workspace` (VS Code multi-root: zinoflow + dichoithoi + khuyenmai, kèm task
  `pnpm dev` / `dotnet run`) nằm ngoài mọi repo. Bản sao được đưa vào thư mục migration.
- 24 file tracked trong zinoflow tham chiếu `docs/dichoithoi/...` (code comment, CLAUDE.md,
  `.github/copilot-instructions.md`, `.claude/skills`).
- Đặt repo con bên trong zinoflow KHÔNG làm hỏng tooling: api tsconfig chỉ `src/**`,
  jest `rootDir: src`, pnpm chỉ `apps/*` + `packages/*`. Hướng đã chọn không đặt repo
  con trong zinoflow, ghi lại để khỏi kiểm tra lại.

## Quyết định đã rõ

- **zinoflow KHÔNG phải tách/tạo lại repo.** Nó đã là repo riêng chứa ứng dụng. Chỉ tạo
  **1 repo cha MỚI**, và zinoflow thành submodule ngang hàng với các repo khác.
- Đề xuất đặt repo cha tại chính thư mục cha (`~/Gits/mmo`), submodule ở **đúng vị trí cũ**
  (`~/Gits/mmo/zinoflow`, `~/Gits/mmo/dichoithoi`...) nên không phải đổi đường dẫn nào
  (`.env` của zinoflow trỏ `../dichoithoi/...`, file workspace, thư mục Claude cho phép).

## Cần hỏi người dùng khi bắt đầu (đã hỏi 26/09, người dùng hẹn làm sau)

1. Repo cha đặt ở đâu: GitHub private `dinhvn/mmo-workspace` (có gh CLI) hay Azure DevOps project MMO.
2. Repo nào làm submodule: 3 repo lõi (zinoflow, dichoithoi, khuyenmai) và/hoặc zinora,
   wordpress-theme, mmo-chrome-extension, protool, Trading. dino-bee (không phải git):
   bỏ qua hay đưa vào dạng thư mục thường.
3. Chuyển doc chung sang repo cha ngay hay để bước sau.

## Giai đoạn

### GĐ1 — Tạo repo cha + gắn submodule
- `git init` tại `~/Gits/mmo`. `.gitignore` phải loại: `migration-mac-*` (**chứa `.env` có
  API key**), `*.bak`, `*.dump`, `*.zip`, `obj/`, các thư mục không phải submodule.
- Với từng repo đã clone sẵn: `git submodule add <url> <tên>`. Git nhận repo có sẵn tại chỗ
  ("Adding existing repo"), không clone lại.
- Đưa `mmo.code-workspace` vào repo cha. Viết README: cách clone
  (`git clone --recursive <url>`), cách cập nhật tất cả
  (`git submodule update --remote --merge`), và lưu ý submodule hay ở trạng thái detached HEAD.
- **Phụ thuộc:** không có (chỉ cần Mac đã khôi phục xong).
- **DoD:** clone repo cha sang một thư mục tạm bằng `--recursive` thì có đủ các repo, đúng nhánh.
  `git status` ở repo cha sạch. File `.env`, `.bak`, `.dump` không bị commit
  (kiểm tra bằng `git ls-files`).

### GĐ2 — Quy trình commit khi sửa nhiều repo
- Cập nhật skill `dichoithoi-commit-both-repos`: sau khi commit và push repo con, commit thêm
  ở repo cha để cập nhật con trỏ submodule, **chỉ khi muốn chốt mốc**. Không bắt buộc mỗi lần.
- **Phụ thuộc:** GĐ1.
- **DoD:** làm thử một thay đổi nhỏ ở dichoithoi theo skill, repo cha ghi đúng commit mới.

### GĐ3 — Chuyển doc dùng chung sang repo cha (tuỳ chọn, hỏi lại người dùng)
- Ứng viên chuyển: `docs/dichoithoi/**` (mô tả sản phẩm xuyên 2 repo). Giữ trong zinoflow:
  `docs/specs`, `idea.md`, `tech-recommendation-web-mvp.md`, `clean-architecture-playbook.md`
  (riêng ứng dụng zinoflow).
- Sửa 24 file tham chiếu, `CLAUDE.md`, `.github/copilot-instructions.md`, các skill.
  Cân nhắc CLAUDE.md ở repo cha import CLAUDE.md của từng repo con.
- Memory Claude Code gắn theo thư mục mở. Nếu từ nay mở Claude ở `~/Gits/mmo` thay cho
  `~/Gits/mmo/zinoflow`, phải chép memory sang thư mục project mới (`-Users-<tên>-Gits-mmo`).
- **Phụ thuộc:** GĐ1. Nên làm sau khi xong plan Postgres
  (`docs/dichoithoi/dichoithoi-postgres-migration-plan.md`), để tránh đổi đường dẫn doc
  trong lúc plan đó đang dở.
- **DoD:** `grep -r "docs/dichoithoi"` trong zinoflow chỉ còn các tham chiếu có chủ ý
  (đã đổi sang đường dẫn repo cha). Claude mở ở repo cha đọc được CLAUDE.md và memory.
