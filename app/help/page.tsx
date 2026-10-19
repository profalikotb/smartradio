"use client";
import { CATALOG_REVIEWED_ON } from "@/lib/catalog";
import { useLang } from "@/lib/ui";

export default function HelpPage() {
  const lang = useLang();
  return <div className="page prose">{lang === "ar" ? <Ar /> : <En />}</div>;
}

function Ar() {
  return (
    <>
      <h1 className="page-title">التعليمات</h1>
      <h2>التشغيل</h2>
      <ul>
        <li>اضغط على بطاقة <b>إذاعة القرآن الكريم من القاهرة</b> أو <b>إذاعة الأغاني المصرية</b> في الرئيسية للتشغيل بلمسة واحدة.</li>
        <li>أول تشغيل يحتاج ضغطة منك — المتصفح يمنع التشغيل التلقائي.</li>
        <li>المشغّل في أسفل الشاشة يستمر أثناء التنقل بين الصفحات. اضغط على اسم المحطة لفتح لوحة التحكم الكاملة (مؤقت النوم، حالة الاتصال، التفاصيل).</li>
        <li>عند انقطاع الإنترنت يظهر «لا يوجد اتصال»؛ إذا كنت تستمع فسيعود البث تلقائيًا عند عودة الاتصال. إذا أوقفته بنفسك فلن يعود تلقائيًا أبدًا.</li>
        <li>البث المباشر يحتاج إنترنت دائمًا؛ الحفظ دون اتصال يشمل الواجهة وبيانات المحطات فقط.</li>
      </ul>
      <h2>إذاعة الأغاني والمحطات غير الموثقة</h2>
      <ul>
        <li>لم نعثر حتى {CATALOG_REVIEWED_ON} على رابط بث رسمي موثّق لإذاعة الأغاني. لذلك تظهر «غير موثقة» مع زر إعادة المحاولة.</li>
        <li>افتح «البحث عن بث لهذه المحطة» لعرض مرشحين مصريين من الدليل. جرّب المرشح (يُشغَّل باسمه الأصلي)، ثم اضغط «هذه هي المحطة الصحيحة» إذا تأكدت.</li>
        <li>لا يُشغَّل أي بديل تلقائيًا تحت اسم المحطة.</li>
      </ul>
      <h2>البحث</h2>
      <ul>
        <li>ابحث بالعربية أو الإنجليزية، بالهمزة أو بدونها، مع أخطاء إملائية بسيطة: «اذاعة القران المصرية»، «Quran Cairo»، «الاغانى».</li>
        <li>«فحص الدليل: يعمل» يعني أن Radio Browser فحص الرابط، وليس أن التشغيل نجح على جهازك.</li>
      </ul>
      <h2>المفضلة</h2>
      <ul>
        <li>النجمة للإضافة/الإزالة، والأسهم لإعادة الترتيب، والدبوس للتثبيت في الرئيسية.</li>
        <li>المفضلة محفوظة على هذا الجهاز فقط. استخدم «تصدير» لحفظ نسخة، و«استيراد» لاستعادتها على جهاز آخر.</li>
        <li>تحديثات التطبيق لا تغيّر مفضلتك، والمحطة التي تحذفها لا تعود من تلقاء نفسها.</li>
      </ul>
      <h2>iPhone</h2>
      <ul>
        <li>للتثبيت: Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية». ستحتاج لتسجيل الدخول مرة واحدة داخل التطبيق المثبّت.</li>
        <li>التحكم بالصوت من أزرار الجهاز (iOS لا يسمح بالتحكم من الويب)، ولذلك لا يتوفر الخفض التدريجي في مؤقت النوم على iPhone — يتوقف البث مباشرة.</li>
        <li>قد يوقف iOS التطبيق في الخلفية أحيانًا، فيتأخر مؤقت النوم أو ينقطع البث. لا يوجد منبه يشغّل الراديو والتطبيق مغلق.</li>
      </ul>
      <h2>الخصوصية</h2>
      <p>التطبيق محمي بكلمة مرور على الخادم. لا إعلانات ولا تحليلات ولا طلب للموقع. عند التشغيل يتصل جهازك مباشرة بخادم البث.</p>
    </>
  );
}

function En() {
  return (
    <>
      <h1 className="page-title">Help</h1>
      <h2>Playing</h2>
      <ul>
        <li>Tap <b>Holy Quran Radio — Cairo</b> or <b>Al Aghani Radio</b> on Home to play with one tap.</li>
        <li>The first play needs a tap — browsers block autoplay.</li>
        <li>The bottom player keeps playing while you navigate. Tap the station name for the full panel (sleep timer, connection, details).</li>
        <li>When the internet drops you'll see “Offline”; if you were listening, playback resumes when it returns. If you paused, it never restarts on its own.</li>
        <li>Live radio always needs internet; offline caching covers the interface and station data only.</li>
      </ul>
      <h2>Al Aghani and unverified stations</h2>
      <ul>
        <li>As of {CATALOG_REVIEWED_ON} no official, verifiable stream for Al Aghani was found, so it shows “Unverified” with a Retry button.</li>
        <li>Open “Find a stream for this station” to review Egyptian directory candidates. Test one (it plays under its own name), then tap “This is the correct station” if you're sure.</li>
        <li>No substitute is ever played automatically under the station's name.</li>
      </ul>
      <h2>Search</h2>
      <ul>
        <li>Arabic or English, with or without hamza, small typos OK: “اذاعة القران المصرية”, “Quran Cairo”, “الاغانى”.</li>
        <li>“Directory check: OK” means Radio Browser probed the URL — not that it plays on your device.</li>
      </ul>
      <h2>Favorites</h2>
      <ul>
        <li>Star to add/remove, arrows to reorder, pin to show on Home.</li>
        <li>Favorites live on this device only. Export to back up; import to restore on another device.</li>
        <li>App updates never change your favorites, and a station you remove never comes back by itself.</li>
      </ul>
      <h2>iPhone</h2>
      <ul>
        <li>Install: Safari → Share → “Add to Home Screen”. You'll sign in once inside the installed app.</li>
        <li>Use the hardware volume buttons (iOS blocks web volume control); the sleep timer therefore stops without a fade on iPhone.</li>
        <li>iOS may suspend the app in the background, delaying the sleep timer or stopping audio. There is no alarm that starts radio while the app is closed.</li>
      </ul>
      <h2>Privacy</h2>
      <p>Password-protected on the server. No ads, no analytics, no location request. When playing, your device connects directly to the stream server.</p>
    </>
  );
}
