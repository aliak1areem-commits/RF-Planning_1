/* =========================================================
   🌐 TRANSLATIONS — AR/EN Dictionary
   ========================================================= */
(function() {
  'use strict';

  const TRANSLATIONS = {
    // Common
    '⚠️ ارسم مضلع أولاً': { en: 'Draw a polygon first' },
    '✅ تم نسخ': { en: 'Copied' },
    '📥 تم تنزيل CSV': { en: 'CSV downloaded' },
    '🗑️ تم مسح الرسومات': { en: 'Drawings cleared' },
    '🌐 جاري البحث...': { en: 'Searching...' },
    '❌ فشل الاتصال': { en: 'Connection failed' },
    '🗺️ تم إعادة عرض الخلايا': { en: 'Cells re-displayed' },
    'اختر الحقل أولاً': { en: 'Select field first' },
    '❌ لا توجد خلية بـ': { en: 'No cell with' },
    'تم إلغاء البحث': { en: 'Search cleared' },
    '⚠️ لا توجد خلايا في باند': { en: 'No cells in band' },
    '⚡ فلتر:': { en: 'Filter:' },
    '📸 جاري تجهيز الصورة...': { en: 'Preparing image...' },
    '✅ تم حفظ الصورة': { en: 'Image saved' },
    '❌ فشل التصوير — جرب مرة ثانية': { en: 'Screenshot failed — try again' },
    'اسم الموقع:': { en: 'Bookmark name:' },
    '✅ تم حفظ': { en: 'Saved' },
    '🗑️ تم الحذف': { en: 'Deleted' },
    '📋 تم النسخ': { en: 'Copied' },
    '📍 تم نسخ الإحداثيات': { en: 'Coordinates copied' },
    '❌ ما لقيت': { en: 'Not found' },
    '❌ إحداثيات غير صحيحة': { en: 'Invalid coordinates' },
    '❌ خارج النطاق المسموح': { en: 'Out of allowed range' },
    '👆 اختر خلية من الماب لعرض جيرانها': { en: 'Select a cell on the map to view neighbors' },
    ' خلية داخل المضلع — اضغط': { en: ' cells inside polygon — click' },

    // 3G / IRAT
    '— اختر مشروع —': { en: '— Select Project —' },
    '⏳ جاري القراءة...': { en: 'Reading...' },
    'الملف فارغ': { en: 'File is empty' },
    'لم أجد أعمدة Source/Neighbor في CSV': { en: 'Source/Neighbor columns not found in CSV' },
    ' علاقة (': { en: ' relations (' },
    '✅ تم تحميل': { en: 'Loaded' },
    'لم يُرفع': { en: 'Not uploaded' },
    'تم المسح': { en: 'Cleared' },
    'اختر مشروع أولاً': { en: 'Select project first' },
    'لا توجد بيانات للحفظ': { en: 'No data to save' },
    'أدخل اسم خلية': { en: 'Enter cell name' },
    ' غير موجودة في rf_cells': { en: ' not found in rf_cells' },
    'الأداة للخلايا 3G فقط (تبدأ بـ U)': { en: 'Tool works on 3G cells only (starts with U)' },
    'أدخل اسم خلية 3G': { en: 'Enter 3G cell name' },
    'الخلية غير موجودة': { en: 'Cell not found' },
    'يجب أن تبدأ بـ U (3G)': { en: 'Must start with U (3G)' },
    'أدخل خلايا': { en: 'Enter cells' },
    'شغّل التحليل أولاً': { en: 'Run analysis first' },
    'عرض الموقع الجديد على الماب': { en: 'New site displayed on map' },
    'لا توجد تكرارات': { en: 'No duplicates' },
    ' علاقة في Supabase': { en: ' relations in Supabase' },
    '💾 حفظ في Supabase': { en: 'Save to Supabase' },

    // PSC
    '❌ لا توجد خلايا 3G بـ PSC. تأكد من رفع بيانات 3G أولاً.': { en: 'No 3G cells with PSC. Upload 3G data first.' },
    '❌ نطاق PSC غير صحيح (0-511)': { en: 'Invalid PSC range (0-511)' },
    '❌ لا توجد خلايا PSC في النطاق': { en: 'No PSC cells in range' },
    ' تعارض موجود': { en: ' conflicts found' },
    '✅ لا توجد تعارضات — كل PSCs سليمة': { en: 'No conflicts — all PSCs clean' },
    '— خطيرة (تؤثر على handover)': { en: '— critical (affects handover)' },
    'لا توجد تغييرات': { en: 'No changes' },
    'تطبيق': { en: 'Apply' },
    ' تغيير PSC في Supabase؟': { en: ' PSC changes in Supabase?' },
    '✅ تم تطبيق': { en: 'Applied' },
    ' تغيير': { en: ' changes' },
    ' فشل)': { en: ' failed)' },
    'خطأ:': { en: 'Error:' },
    '✅ تم تصدير CSV': { en: 'CSV exported' },
    ' خلية متعارضة على الماب': { en: ' conflict cells on map' },

    // BSIC
    'ابحث عن خلايا لها نفس BCCH + BSIC ضمن مسافة محددة (تحليل مركّز على BCCH محدد).':
      { en: 'Find cells with same BCCH + BSIC within a specified distance.' },
    'تحليل كل خلايا GSM — كشف كل تعارضات BSIC وإعادة توزيع كامل.':
      { en: 'Analyze all GSM cells — detect and reassign all BSIC conflicts.' },
    'اتركه فارغاً لكل الخلايا': { en: 'Leave empty for all cells' },
    'فارغ = كل خلايا GSM': { en: 'Empty = all GSM cells' },
    'مسافة اعتبار نفس BSIC تعارضاً': { en: 'Distance for same-BSIC conflict' },
    'نطاق عد الجيران': { en: 'Neighbor count radius' },
    ' خلية تحتاج تغيير BSIC': { en: ' cells need BSIC change' },
    '✅ لا توجد تعارضات — كل BSICs سليمة': { en: 'No conflicts — all BSICs clean' },
    'هذا سيحدّث قاعدة البيانات.': { en: 'This will update the database.' },

    // HSN
    '— خلايا نفس الموقع لها نفس HSN': { en: '— same-site cells with same HSN' },
    '— خلايا متجاورة لها نفس HSN': { en: '— neighboring cells with same HSN' },
    'هذا سيحدّث': { en: 'This will update' },
    ' خلية.': { en: ' cells.' },

    // Symmetry
    '✅ كل العلاقات متماثلة!': { en: 'All relations are symmetric!' },
    '⚠️ عنده علاقة غير متماثلة': { en: 'Has asymmetric relation' },
    ' علاقة غير متماثلة على الماب': { en: ' asymmetric relations on map' },
    'الجيران المقبولون فقط ضمن هذه المسافة': { en: 'Only neighbors within this distance' },
    'للتحقق من العلاقات المفقودة': { en: 'For checking missing relations' },

    // Azimuth Opt
    'اتركه فارغاً = تحليل كل الخلايا': { en: 'Leave empty = analyze all cells' },
    '✅ كل الخلايا محسّنة — لا تغيير مطلوب': { en: 'All cells optimized — no changes needed' },

    // New Site
    '🔒 منع تكرار BCCH/PSC/PCI على نفس الموقع (Co-site Rules)':
      { en: 'Prevent duplicate BCCH/PSC/PCI on same site (Co-site Rules)' },
    '📏 إعادة استخدام القيم فقط على مسافة آمنة':
      { en: 'Reuse values only at safe distance' },
    '🎯 تجنب التعارض الأمامي (Face-to-Face)':
      { en: 'Avoid face-to-face conflicts' },
    '🔗 اقتراح الجيران تلقائياً': { en: 'Auto-suggest neighbors' },
    '↔️ جيران ثنائي الاتجاه (Bidirectional)':
      { en: 'Bidirectional neighbors' },
    'أدخل اسم الموقع': { en: 'Enter site name' },
    'إحداثيات غير صحيحة': { en: 'Invalid coordinates' },
    'الاسم يحتوي أحرف غير مسموحة': { en: 'Name contains invalid characters' },
    'اسم الموقع موجود مسبقاً': { en: 'Site name already exists' },
    'عدد الجيران قليل للاقتراح': { en: 'Not enough neighbors to suggest' },
    'أدخل إحداثيات أولاً': { en: 'Enter coordinates first' },
    'تم اقتراح Azimuths بناءً على': { en: 'Suggested azimuths based on' },
    ' جار': { en: ' neighbors' },
    'التخطيط جاهز': { en: 'Plan ready' },
    'سيتم إضافة:': { en: 'Will add:' },
    ' خلية جديدة': { en: ' new cells' },
    ' علاقة جيران جديدة': { en: ' new neighbor relations' },
    ' علاقة عكسية (Bidirectional)': { en: ' reverse relations (Bidirectional)' },
    ' تعارض خطير — يُنصح بمراجعتها أولاً': { en: ' HIGH conflicts — review first' },
    '✅ لا تعارضات خطيرة': { en: 'No HIGH conflicts' },
    '✅ التخطيط نظيف!': { en: 'Plan is clean!' },
    'لا توجد تعارضات خطيرة. يمكنك الحفظ بأمان.':
      { en: 'No critical conflicts. Safe to save.' },
    ' تعارض خطير و': { en: ' HIGH conflicts and' },
    ' تعارض متوسط': { en: ' MEDIUM conflicts' },
    'راجع تبويب "Conflicts" قبل الحفظ': { en: 'Review the "Conflicts" tab before saving.' },
    'هل أنت متأكد؟ سيتم مسح التخطيط.': { en: 'Are you sure? Clear current plan?' },

    // Site Info
    'اكتب ملاحظتك...': { en: 'Write your comment...' },
    'سيظهر التعليق لكل الفريق · يدعم النص العادي والروابط':
      { en: 'Comment visible to team · supports text and links' },
    'لا توجد ملاحظات بعد': { en: 'No comments yet' },
    'ما فيه Bookmarks بعد': { en: 'No bookmarks yet' },
    ' خلية بـ': { en: ' cells with' },
    ' نتيجة': { en: ' results' }
  };

  function translateText(str, targetLang) {
    if (!str || typeof str !== 'string') return str;
    if (targetLang === 'ar') return str;

    let result = str;
    const entries = Object.entries(TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
    for (const [ar, langs] of entries) {
      if (result.includes(ar)) {
        result = result.split(ar).join(langs.en);
      }
    }
    result = result.replace(/  +/g, ' ');
    return result;
  }

  window.TRANSLATIONS = TRANSLATIONS;
  window.translateText = translateText;

  console.log('✅ Translations loaded');
})();
