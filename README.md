# Công cụ Xuất / Nhập Cookie

Đây là tiện ích Chrome Extension chạy nội bộ để xuất và nhập cookie. Tiện ích dùng Manifest V3, không có bước build, không dùng npm, không dùng thư viện ngoài, không dùng CDN và không gửi cookie đến bất kỳ máy chủ nào.

## Cách cài vào Chrome, Edge hoặc Brave

1. Mở trình duyệt và vào `chrome://extensions`.
2. Bật `Developer mode`.
3. Bấm `Load unpacked`.
4. Chọn thư mục `cookie-export-import-tool`.
5. Ghim extension lên thanh công cụ nếu cần dùng thường xuyên.

## Cách xuất cookies.txt cho yt-dlp

1. Mở `youtube.com` hoặc `studio.youtube.com` trong tab đang đăng nhập.
2. Mở extension `Công cụ Xuất / Nhập Cookie`.
3. Chọn tab `Xuất cookie`.
4. Chọn `Nguồn cookie`: `Tab hiện tại`, `Tên miền`, hoặc `Tất cả cookie`.
5. Chọn `Định dạng` là `Netscape cookies.txt`.
6. Bấm `Xuất / Tải xuống` để xuất file cookies.txt, hoặc bấm `Sao chép cookie` nếu muốn copy nội dung.
7. Mở `Chi tiết cookie` chỉ khi muốn kiểm tra bảng cookie trước hoặc sau khi xuất.

## Cách nhập cookie

1. Mở tab `Nhập cookie`.
2. Chọn file cookie hoặc dán cookie vào ô `Dán cookie tại đây`.
3. Chọn `Chế độ nhập`.
4. Bấm `Nhập cookie`; extension sẽ tự nhận diện Netscape, JSON hoặc Header String trước khi xử lý.
5. Xem `Nhật ký kết quả` sau khi chạy để biết cookie nào thành công, bị bỏ qua hoặc lỗi.
6. Mở `Chi tiết cookie` chỉ khi muốn kiểm tra bảng cookie.
7. `Tên miền đích` nằm trong `Tuỳ chọn nâng cao`, chỉ cần khi dùng Header String hoặc muốn ép cookie vào domain cụ thể.
8. Nếu chọn `Xóa cookie cũ của tên miền rồi nhập lại`, hãy đọc cảnh báo và tick `Tôi hiểu và muốn tiếp tục.`. Chế độ này sẽ xóa cookie hiện có của domain bị ảnh hưởng trước khi nhập cookie mới.

## Cảnh báo bảo mật

Cookie là dữ liệu nhạy cảm. Ai có file cookies.txt có thể truy cập phiên đăng nhập của bạn trong một số trường hợp. Không chia sẻ file cookie cho người khác, không đưa lên dịch vụ trực tuyến, và nên xóa file sau khi dùng xong.

Việc nhập cookie Google hoặc YouTube không đảm bảo đăng nhập thành công. Hệ thống bảo mật tài khoản có thể kiểm tra IP, thiết bị, phiên đăng nhập, token, hạn sử dụng và các tín hiệu rủi ro khác.

## Cookie có thể nhanh hết hạn vì sao?

- Cookie export là ảnh chụp phiên đăng nhập tại thời điểm xuất.
- Cookie không phải token API ổn định lâu dài.
- Website có thể revoke phiên từ phía server mà không cần chờ hết `expirationDate`.
- Google hoặc YouTube có thể yêu cầu xác minh lại hoặc ràng buộc phiên với thiết bị, trình duyệt và ngữ cảnh sử dụng.
- File cookie không chứa Local Storage, IndexedDB hoặc Service Worker cache của website.

## Báo cáo chất lượng cookie

Sau khi xử lý export hoặc import, popup hiển thị báo cáo ngắn để đọc nhanh trạng thái cookie:

- `Tổng`: tổng số cookie đã phân tích.
- `Phiên`: cookie phiên, thường mất khi phiên trình duyệt liên quan kết thúc.
- `Có hạn`: cookie có `expirationDate` dương.
- `Hết hạn`: cookie có hạn đã qua và sẽ bị bỏ qua khi nhập.
- `Sắp hết hạn 24h`: cookie có hạn gần, cần chú ý nếu dùng cho quy trình tải hoặc API.
- `Có partitionKey`: cookie partitioned có metadata `partitionKey` được giữ khi định dạng cho phép.

## Dùng trong ẩn danh

1. Vào `chrome://extensions`, mở chi tiết extension và bật `Cho phép ở chế độ ẩn danh`.
2. Mở popup từ tab cần thao tác trong cửa sổ thường hoặc cửa sổ ẩn danh.
3. Extension dùng cookie store của tab hiện tại khi phát hiện được.

Cookie trong cửa sổ ẩn danh có thể mất khi đóng toàn bộ cửa sổ ẩn danh.

## Khuyến nghị dùng

- Nếu dùng cho `yt-dlp` hoặc tool tải khác, hãy export cookie ngay trước khi tải.
- Không kỳ vọng file cookie dùng ổn định lâu dài.
- Nếu cần ổn định dài hạn, ưu tiên cơ chế đăng nhập hoặc API chính thức nếu website có hỗ trợ.
- Tránh import toàn bộ cookie vào profile chính nếu không cần.

## Xử lý sự cố

- Không thấy cookie: kiểm tra `host_permissions` trong `manifest.json`, đảm bảo trang đang mở là `http` hoặc `https`, và thử lại với chế độ `Tên miền`.
- Nhập thất bại: kiểm tra `domain`, `path`, `secure`, `sameSite`, `expiry` và giá trị cookie.
- Header String cần `Tên miền đích` trong `Tuỳ chọn nâng cao` vì định dạng này không có domain/path/expiry.
- `Tất cả cookie` quá lớn: hãy dùng chế độ `Tên miền` để giới hạn phạm vi xuất.
- Không load được extension: đảm bảo các file icon trong `icons/` tồn tại và chọn đúng thư mục `cookie-export-import-tool` khi `Load unpacked`.

## Cấu trúc file

- `manifest.json`: khai báo Manifest V3, quyền cookies/tabs/storage/downloads và host permissions nội bộ.
- `popup.html`: giao diện popup với tab `Xuất cookie` và `Nhập cookie`.
- `popup.css`: style popup, bảng chi tiết có scroll ngang/dọc.
- `popup.js`: điều khiển UI, sự kiện nút bấm, chi tiết cookie, sao chép, tải xuống và nhập cookie.
- `background.js`: service worker tối thiểu, không xử lý mạng.
- `lib/cookie-api.js`: bọc Chrome cookies/tabs/downloads API.
- `lib/cookie-export.js`: điều phối lấy cookie và tạo nội dung export.
- `lib/cookie-import.js`: điều phối chạy thử, gộp và xóa cookie theo tên miền.
- `lib/format-netscape.js`: xuất/nhập Netscape cookies.txt.
- `lib/format-json.js`: xuất/nhập JSON.
- `lib/format-header.js`: xuất/nhập Header String.
- `lib/validator.js`: validate và chuẩn hóa cookie trước khi import.
- `lib/utils.js`: helper domain, mask value, timestamp, copy clipboard và bảng UI.
- `icons/`: icon placeholder PNG hợp lệ. Có thể thay bằng icon riêng cùng kích thước 16, 48 và 128.
