"""Yangi spiker videosini to'liq Graph API orqali yoqish (Ads Manager/Chrome kerak emas, Forum APP Live rejimda).
Qoida (CLAUDE.md): har bir yangi video — alohida kampaniya, CBO $10/kun, UZ 25+ Advantage+, forma v3,
Ibrat Farzandlari bilan partnership, matn andoza e'londan olinadi.
Ishlatish: python3 server/launch_video.py <video.mp4> "<Spiker Ism Familiya (Kompaniya)>" [--paused]"""
import json, os, re, sys, time, shutil, subprocess, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for line in open(os.path.join(ROOT, "server", ".env"), encoding="utf-8"):
    m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
    if m and m[1] not in os.environ: os.environ[m[1]] = m[2].strip().strip('"').strip("'")

T = os.environ["META_SYSTEM_USER_TOKEN"]
G = "https://graph.facebook.com/v23.0"
ACT = "act_1338204998260984"
PAGE = "1339727935893840"
TEMPLATE_CREATIVE = "1579034130648261"  # Temurbek Athamov e'loni: matn, forma v3, partnership, enhancements
BUDGET_CENTS = 1000


def api(method, path, **params):
    params["access_token"] = T
    data = {k: json.dumps(v) if isinstance(v, (dict, list)) else str(v) for k, v in params.items()}
    if method == "GET":
        req = urllib.request.Request(f"{G}/{path}?{urllib.parse.urlencode(data)}")
    else:
        req = urllib.request.Request(f"{G}/{path}", data=urllib.parse.urlencode(data).encode(), method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read() or b"{}").get("error", {})
        sys.exit(f"Meta xatosi ({path}): {err.get('error_user_msg') or err.get('message')}")


def upload(video, name):
    # curl multipart — 30+ MB faylni urllib bilan yuborish noqulay
    out = subprocess.run(["curl", "-s", "-X", "POST", f"{G}/{ACT}/advideos", "-F", f"access_token={T}",
                          "-F", f"name={name}", "-F", f"source=@{video}"], capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    if "id" not in d: sys.exit(f"Video yuklanmadi: {out[:300]}")
    return d["id"]


def wait_ready(vid):
    for _ in range(60):
        st = api("GET", vid, fields="status").get("status", {}).get("video_status")
        if st == "ready": return
        if st == "error": sys.exit("Meta videoni qayta ishlay olmadi")
        time.sleep(10)
    sys.exit("Video 10 daqiqada tayyor bo'lmadi")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2: sys.exit(__doc__)
    video, speaker = args
    paused = "--paused" in sys.argv
    slug = re.sub(r"[^a-z0-9]+", "-", speaker.lower()).strip("-")

    vid = upload(video, f"spiker-{slug}-9x16"); print("video", vid)
    camp = api("POST", f"{ACT}/campaigns", name=f"Forum 2026 | Spiker {speaker}", objective="OUTCOME_LEADS",
               status="PAUSED", daily_budget=BUDGET_CENTS, bid_strategy="LOWEST_COST_WITHOUT_CAP", special_ad_categories=[])["id"]
    adset = api("POST", f"{ACT}/adsets", name="UZ | 25+ | Advantage+ | Instant forma v3", campaign_id=camp,
                optimization_goal="LEAD_GENERATION", billing_event="IMPRESSIONS", destination_type="ON_AD",
                promoted_object={"page_id": PAGE}, status="PAUSED",
                targeting={"age_min": 25, "age_max": 65, "geo_locations": {"countries": ["UZ"], "location_types": ["home", "recent"]},
                           "targeting_automation": {"advantage_audience": 1}})["id"]
    print("kampaniya", camp, "guruh", adset)

    wait_ready(vid)
    thumbs = api("GET", f"{vid}/thumbnails").get("data", [])
    thumb = next((t["uri"] for t in thumbs if t.get("is_preferred")), thumbs[0]["uri"] if thumbs else None)

    tpl = api("GET", TEMPLATE_CREATIVE, fields="object_story_spec,degrees_of_freedom_spec,facebook_branded_content,instagram_branded_content,contextual_multi_ads")
    oss = tpl["object_story_spec"]
    vd = oss["video_data"]
    for k in ("image_url", "image_hash"): vd.pop(k, None)
    vd["video_id"] = vid
    if thumb: vd["image_url"] = thumb
    dof = tpl["degrees_of_freedom_spec"]
    dof["creative_features_spec"].pop("standard_enhancements", None)  # Meta endi qabul qilmaydi
    creative = api("POST", f"{ACT}/adcreatives", name=f"Spiker {speaker} | 9x16 | forma v3", object_story_spec=oss,
                   degrees_of_freedom_spec=dof, facebook_branded_content=tpl["facebook_branded_content"],
                   instagram_branded_content=tpl["instagram_branded_content"], contextual_multi_ads=tpl["contextual_multi_ads"])["id"]
    ad = api("POST", f"{ACT}/ads", name=f"Spiker {speaker} | 9x16 | forma v3", adset_id=adset,
             creative={"creative_id": creative}, status="ACTIVE")["id"]
    print("kreativ", creative, "e'lon", ad)

    if not paused:
        api("POST", adset, status="ACTIVE"); api("POST", camp, status="ACTIVE")
    print("holat:", "PAUSED" if paused else "ACTIVE")

    dst = os.path.join(ROOT, "kreativlar", "yuklangan", f"{vid}_spiker-{slug}-9x16{os.path.splitext(video)[1].lower()}")
    if os.path.abspath(video).startswith(os.path.join(ROOT, "kreativlar", "yangi")):
        shutil.move(video, dst); print("fayl ->", dst)


if __name__ == "__main__":
    main()
