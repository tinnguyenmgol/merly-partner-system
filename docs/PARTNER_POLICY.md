# Chính sách đối tác CTV Merly

CTV không ôm hàng giới thiệu/chốt đơn; Merly xử lý hàng, giao hàng và thu tiền. Hoa hồng tính trên `eligible_product_revenue`: doanh thu sản phẩm thực thu sau giảm giá, không gồm phí vận chuyển, phụ phí, hộp/túi, COD/dịch vụ hoặc khoản không phải sản phẩm.

Mặc định: giá niêm yết 10%; giảm 5%–10% là 7%; giảm không được phép là 0%; giảm trên 10%, xả kho hoặc sale sâu cần duyệt thủ công/chính sách chiến dịch. Mốc 10 và 30 đơn chỉ tạo điều kiện đề xuất 12%/15%, không tự động áp dụng nếu chưa có admin duyệt.

Đơn hợp lệ phải được thanh toán, giao thành công, không hủy/hoàn/từ chối/tranh chấp và qua 7 ngày đối soát. Thanh toán tối thiểu 100.000 VND; dưới mức này chuyển kỳ sau. Màn hình admin hiện chỉ tính số dư đủ điều kiện thanh toán, chưa thực hiện chuyển khoản hoặc đánh dấu đã chi trả.

Đơn cá nhân/gia đình được phép nếu thật, đã trả tiền, giao thành công và không hoàn/hủy/tranh chấp. Mẫu đáng ngờ chỉ gắn cờ để admin xem xét, không tự động loại.

Tương lai cần phân biệt CTV không ôm hàng với CTV nhập hàng/đại lý có tồn kho, công nợ và giá sỉ riêng.

## Attribution rules

`referral_ctv` cá nhân được ghi nhận bằng affiliate link (`?ref=`, `?aff=`, `?ctv=`, `?partner=`), gắn thủ công bởi admin, hoặc future order request. Khách hàng không cần mã giảm giá để CTV cá nhân được ghi nhận doanh thu.

`shop_referral` / shop big-size dùng discount code làm cơ chế gắn đơn chính. Discount code của shop có thể vừa giảm giá cho khách vừa cấu hình tỷ lệ hoa hồng shop.

Commission engine các bước sau phải tính theo partner type/program; không dùng discount code làm mặc định cho `referral_ctv` cá nhân.

## CTV login and dashboard visibility
Sau khi admin duyệt hồ sơ `referral_ctv`, hệ thống tạo tài khoản đăng nhập ở trạng thái `invited`. Admin copy link thiết lập mật khẩu thủ công cho CTV; link hết hạn sau 7 ngày, chỉ dùng một lần và không lưu raw token trong database. CTV đặt mật khẩu tối thiểu 8 ký tự rồi đăng nhập tại `/dang-nhap` bằng email hoặc số điện thoại.

Dashboard CTV chỉ truy vấn dữ liệu theo partner id trong session hiện tại: mã giới thiệu, đơn đã attribution, ledger hoa hồng, trạng thái đủ mức thanh toán tối thiểu 100.000 VND và hồ sơ thanh toán read-only. Admin có thể disable/enable tài khoản đăng nhập; các hành động này tạo audit log. Reset mật khẩu hiện dùng cùng cơ chế link thủ công do admin regenerate, chưa gửi email/SMS và chưa có OTP.
