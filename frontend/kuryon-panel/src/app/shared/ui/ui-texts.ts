export const UI_TEXTS = {
  common: {
    fixFormErrors: 'Lütfen formdaki hataları düzeltin.',
    loginFailed: 'Giriş başarısız.'
  },
  auth: {
    phoneRequired: 'Telefon numarası zorunludur.',
    validPhone: 'Geçerli bir telefon numarası girin.',
    passwordRequired: 'Şifre zorunludur.',
    passwordMinLength: 'Şifre en az 6 karakter olmalıdır.',
    validEmail: 'Geçerli bir e-posta girin.',
    courierNotFound: 'Kurye kaydı bulunamadı.'
  },
  admin: {
    companyRequired: 'Firma alanı zorunludur.',
    customerRequired: 'Müşteri alanı zorunludur.',
    addressRequired: 'Adres alanı zorunludur.',
    addressMinLength: 'Adres en az 10 karakter olmalıdır.',
    feeRange: 'Ücret 0 ile 100000 arasında olmalıdır.',
    customerPhoneInvalid: 'Müşteri telefonu geçersiz.',
    restaurantPhoneRequired: 'Restoran telefonu zorunludur.',
    restaurantPhoneInvalid: 'Restoran telefonu geçersiz.',
    etaRequired: 'ETA alanı zorunludur.',
    orderSaveFailed: 'Sipariş kaydedilemedi.'
  },
  dashboard: {
    statTotalOrders: 'Toplam Sipariş',
    statTotalCouriers: 'Toplam Kurye',
    statOnlineCouriers: 'Çevrimiçi Kurye',
    statOfflineCouriers: 'Çevrimdışı Kurye',
    statBreakCouriers: 'Moladaki Kurye',
    trendActive: 'Aktif',
    trendPassive: 'Pasif',
    trendLiveData: 'Canlı veri',
    statusAvailable: 'Müsait',
    statusFull: 'Dolu',
    orderUnavailable: 'Bu sipariş artık atanmış veya listede yok.',
    orderNotAssignable: 'Sipariş artık atanabilir durumda değil.',
    assignError: 'Kurye atama sırasında hata oluştu.',
    orderDeleted: 'kaydı silindi.',
    onlyReadyPickupDelete: 'Sadece "Hazır Alınacak" durumundaki siparişler silinebilir.',
    emptyFilteredOrders: 'Filtreye uygun sipariş bulunamadı.',
    emptyActiveOrders: 'Yolda veya hazır alınacak sipariş bulunmuyor.',
    emptyBreakCouriers: 'Şu an molada kurye bulunmuyor.',
    emptyFilteredCouriers: 'Seçili filtreye uygun kurye bulunamadı.',
    assignButton: 'Kurye Ata',
    assigning: 'Atanıyor...'
  },
  reports: {
    totalOrders: 'Toplam Sipariş',
    totalRevenue: 'Toplam Gelir',
    cashPayment: 'Nakit Ödeme',
    cardPayment: 'Kart Ödeme',
    totalDeliveryFee: 'Toplam teslimat ücreti',
    ratioSuffix: 'oran'
  },
  orders: {
    assignOrder: 'Sipariş Ata',
    noAssignPermission: 'Sipariş atama yetkisi yok',
    emptyFilteredOrders: 'Aradığınız kriterlere uygun sipariş bulunamadı.'
  },
  couriers: {
    fullNameRequired: 'Ad soyad zorunludur.',
    phoneRequired: 'Telefon zorunludur.',
    validPhone: 'Geçerli bir telefon numarası girin.',
    passwordRequired: 'Şifre zorunludur.',
    passwordMinLength: 'Şifre en az 6 karakter olmalıdır.',
    ibanRequired: 'IBAN zorunludur.',
    validIban: 'Geçerli bir TR IBAN girin.',
    leaveDayRange: 'İzin günü 1-30 arasında olmalıdır.',
    shiftStartBeforeEnd: 'Vardiya başlangıcı bitişten önce olmalıdır.',
    shiftEndAfterStart: 'Vardiya bitişi başlangıçtan sonra olmalıdır.'
  },
  storePanel: {
    callCourierNoOrder: 'Kurye çağrısı için uygun sipariş bulunamadı. Lütfen tekrar deneyin.',
    callCourierSuccess:
      'siparişi kurye havuzuna eklendi; uygun kurye siparişi üzerine alabilir.',
    paymentInfoMissing: 'Ödeme bilgisi yok'
  },
  courierPanel: {
    releaseToPoolConfirm:
      'Bu siparişi havuza geri bırakmak istiyor musunuz? Diğer kuryeler siparişi tekrar üzerine alabilir.',
    addressHiddenAfterPickup: 'Adres gizli - teslim alma sonrası açılır',
    poolEmpty: 'Havuzda bekleyen atanmamış sipariş bulunmuyor.',
    assignedPackagesEmpty: 'Şu an üzerinize atanmış aktif paket bulunmuyor.',
    reportsOpenDetail: 'Detay için tıklayın',
    reportsNoDailySummary: 'Henüz günlük teslim özeti oluşturacak kayıt yok.',
    reportsOpenAllOrders: 'Tüm siparişleri ve satır detaylarını açın',
    reportsPaymentDetailAria: 'Toplam kazanç detayını açın',
    reportsSeeDayPayments: 'günü ödeme dağılımını göster'
  },
  error: {
    unexpected: 'Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin veya tekrar deneyin.'
  }
} as const;

