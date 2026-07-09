---
name: dichoithoi-commit-both-repos
description: Chuẩn hoá việc commit khi 1 phase/tính năng dichoithoi chạm cả 2 repo (zinoflow + dichoithoi) — commit tách biệt theo repo, đúng convention message, không gộp nhầm hoặc quên 1 bên. Dùng khi được yêu cầu commit sau khi hoàn thành việc liên quan dichoithoi.
---

# Dichoithoi — Commit tách biệt 2 repo

## Nguyên tắc

`zinoflow` và `dichoithoi` là 2 git repo ĐỘC LẬP (dichoithoi host trên Azure
DevOps, không phải GitHub — xem memory `dichoithoi-phase17-cloudflare-followup`).
Không bao giờ có 1 commit "chung" — luôn commit riêng ở từng repo có thay
đổi, theo đúng convention của repo đó.

## Trước khi commit

1. Chạy lại skill `dichoithoi-sync-check`: xác nhận đã thực sự sửa đúng
   những gì cần ở mỗi repo (không sót 1 bên nếu phase yêu cầu cả 2), và không
   commit thừa file không liên quan.
2. Nếu vừa test bằng trình duyệt/sqlcmd (skill `qa-audit` ở repo dichoithoi)
   — kiểm tra không còn dữ liệu test/file `.sql` tạm lẫn vào staged changes, và
   không commit file build output (`wwwroot/css/*.css` đã gitignore).
3. `git status` ở CẢ 2 repo trước khi commit — dùng đường dẫn tuyệt đối, vì
   thư mục làm việc hiện tại (cwd) trong 1 phiên có thể đang ở repo khác.

## Format message

**dichoithoi**: `<type>(dichoithoi): <mô tả ngắn>` — ví dụ đã dùng:
`feat(dichoithoi): Phase 18.4 - trang chi tiet diem den (/diem-den/{slug}) Tailwind + 4 nhanh kind`,
`fix(dichoithoi): doi duong dan thumbnail diem den tu tuong doi sang tuyet doi`.
Nội dung message dùng tiếng Việt KHÔNG dấu (quy ước hiện tại của các commit
dichoithoi trong lịch sử repo) — khác với chuẩn "phải có dấu" chỉ áp dụng cho
text hiển thị cho người dùng cuối trên website, không áp dụng cho commit
message/code comment.

**zinoflow**: `<type>(<scope>): <mô tả ngắn>` theo CLAUDE.md §8 — ví dụ:
`docs(dichoithoi): danh dau Phase 18.5 xong - Phase 18 (dap di lam lai UI) hoan tat`,
`feat(dichoithoi): Phase 18.2 - trang danh muc (/loai, /tinh) Tailwind + noi dung + phan trang`.
Nếu chỉ cập nhật `docs/dichoithoi/dichoithoi-implementation-plan.md` để đánh
dấu phase xong — dùng prefix `docs(dichoithoi):`.

Cả 2 repo: message kết thúc bằng dòng
`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Thứ tự commit khi cả 2 repo cùng đổi

1. Commit code + fix ở repo thực sự chứa thay đổi hành vi trước (thường là
   `dichoithoi` nếu là sửa UI/behavior website, hoặc `zinoflow` nếu là
   schema/API/admin UI mới).
2. Nếu zinoflow chỉ cần cập nhật doc (`dichoithoi-implementation-plan.md`
   đánh dấu ĐÃ XONG) sau khi code dichoithoi xong và đã verify — commit doc
   đó SAU, tách riêng với message `docs(dichoithoi): ...`, không gộp vào
   commit code nếu code đó nằm ở repo khác.
3. Không bao giờ push tự động — chỉ commit local trừ khi người dùng yêu cầu
   push rõ ràng.

## Trước khi tạo commit — luôn hỏi lại nếu

- Không chắc thay đổi có nên tách thành nhiều commit nhỏ hơn theo sub-phase
  hay gộp 1 commit — mặc định dự án này ưu tiên 1 commit gọn theo sub-phase
  đã hoàn thành và verify xong, không commit dở dang.
- Phát hiện file lạ/thay đổi không rõ nguồn gốc khi `git status` — điều tra
  trước khi `git add`, có thể là việc dở dang của người dùng.
