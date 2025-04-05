function fetchTournaments() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("STARTGG_API_KEY");
  const spreadsheetId = '1_Ad2ra6_NAVN0QWXm0XdtwiBFBm2dQIsuRQe99vzccQ';
  const sheetName = '大会リスト（Start.gg自動取得）';
  const perPage = 55;
  const currentTime = Math.floor(Date.now() / 1000);

  const query = `
    query TournamentsByCountry($cCode: String!, $perPage: Int!, $page: Int!, $afterDate: Timestamp!) {
      tournaments(query: {
        perPage: $perPage
        page: $page
        filter: {
          countryCode: $cCode,
          videogameIds: [1386],
          afterDate: $afterDate
        }
      }) {
        nodes {
          id
          images {
            url
          }
          isRegistrationOpen
          mapsPlaceId
          name
          numAttendees
          registrationClosesAt
          slug
          startAt
          venueAddress
        }
        pageInfo {
          totalPages
        }
      }
    }`;

  const apiUrl = 'https://api.start.gg/gql/alpha';
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  sheet.clear();

  // ヘッダー設定
  const headers = [
    '地域', '都道府県', '画像', '大会名', '開催日時', '受付中', 
    '受付締切', '参加人数', 'start.ggリンク', 'Googleマップリンク', '会場住所'
  ];
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  let page = 1;
  let hasMoreData = true;
  const tournamentData = [];

  while (hasMoreData) {
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      payload: JSON.stringify({
        query: query,
        variables: { cCode: 'JP', perPage: perPage, page: page, afterDate: currentTime }
      })
    });

    const data = JSON.parse(response.getContentText());
    const tournaments = data.data?.tournaments?.nodes;
    const totalPages = data.data?.tournaments?.pageInfo?.totalPages;

    if (!tournaments || tournaments.length === 0) break;

    tournaments.forEach(tournament => {
      const name = tournament.name;
      const imageUrl = getSquareImage(tournament.images);
      const registrationOpen = tournament.isRegistrationOpen ? '受付中' : '締切';
      const mapsLink = tournament.mapsPlaceId ? `=HYPERLINK("https://www.google.com/maps/place/?q=place_id:${tournament.mapsPlaceId}", "地図")` : 'N/A';
      const numAttendees = tournament.numAttendees;
      const registrationCloses = formatDate(tournament.registrationClosesAt);
      const startDate = formatDate(tournament.startAt);
      const startLink = `=HYPERLINK("https://www.start.gg/${tournament.slug}", "リンク")`;
      const venueAddress = tournament.venueAddress;
      const prefecture = convertPrefecture(extractPrefecture(venueAddress));
      const region = getRegion(prefecture);

      // 画像セルの生成
      const imageCell = imageUrl !== 'N/A' ? `=IMAGE("${imageUrl}", 4, 60, 60)` : 'N/A';

      const row = [
        region, prefecture, imageCell, name, startDate, registrationOpen, 
        registrationCloses, numAttendees, startLink, mapsLink, venueAddress
      ];
      tournamentData.push(row);
    });

    page++;
    if (page > totalPages) break;
  }

  // 開催日時の昇順でソート
  tournamentData.sort((a, b) => new Date(a[4]) - new Date(b[4]));
  tournamentData.forEach(row => sheet.appendRow(row));

  Logger.log('Tournament data updated.');
}

// 日付フォーマット
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp * 1000);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
}

// 正方形の画像を取得
function getSquareImage(images) {
  if (!images || images.length === 0) return 'N/A';
  return images.find(image => image.url.includes('image-'))?.url || images[0].url;
}

// 都道府県名抽出
function extractPrefecture(address) {
  if (!address) return 'N/A';
  const prefecturePattern = /(Hokkaido|Aomori|Iwate|Miyagi|Akita|Yamagata|Fukushima|Ibaraki|Tochigi|Gunma|Saitama|Chiba|Tokyo|Kanagawa|Niigata|Toyama|Ishikawa|Fukui|Yamanashi|Nagano|Gifu|Shizuoka|Aichi|Mie|Shiga|Kyoto|Osaka|Hyogo|Nara|Wakayama|Tottori|Shimane|Okayama|Hiroshima|Yamaguchi|Tokushima|Kagawa|Ehime|Kochi|Fukuoka|Saga|Nagasaki|Kumamoto|Oita|Miyazaki|Kagoshima|Okinawa|北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
  const match = address.match(prefecturePattern);
  return match ? match[0] : 'N/A';
}


// 英語都道府県名を日本語に変換
function convertPrefecture(pref) {
  const conversions = {
    "Hokkaido": "北海道",
    "Aomori": "青森県",
    "Iwate": "岩手県",
    "Miyagi": "宮城県",
    "Akita": "秋田県",
    "Yamagata": "山形県",
    "Fukushima": "福島県",
    "Ibaraki": "茨城県",
    "Tochigi": "栃木県",
    "Gunma": "群馬県",
    "Saitama": "埼玉県",
    "Chiba": "千葉県",
    "Tokyo": "東京都",
    "Kanagawa": "神奈川県",
    "Niigata": "新潟県",
    "Toyama": "富山県",
    "Ishikawa": "石川県",
    "Fukui": "福井県",
    "Yamanashi": "山梨県",
    "Nagano": "長野県",
    "Gifu": "岐阜県",
    "Shizuoka": "静岡県",
    "Aichi": "愛知県",
    "Mie": "三重県",
    "Shiga": "滋賀県",
    "Kyoto": "京都府",
    "Osaka": "大阪府",
    "Hyogo": "兵庫県",
    "Nara": "奈良県",
    "Wakayama": "和歌山県",
    "Tottori": "鳥取県",
    "Shimane": "島根県",
    "Okayama": "岡山県",
    "Hiroshima": "広島県",
    "Yamaguchi": "山口県",
    "Tokushima": "徳島県",
    "Kagawa": "香川県",
    "Ehime": "愛媛県",
    "Kochi": "高知県",
    "Fukuoka": "福岡県",
    "Saga": "佐賀県",
    "Nagasaki": "長崎県",
    "Kumamoto": "熊本県",
    "Oita": "大分県",
    "Miyazaki": "宮崎県",
    "Kagoshima": "鹿児島県",
    "Okinawa": "沖縄県"
  };
  return conversions[pref] || pref;
}

// 地域取得
function getRegion(pref) {
  const regionMap = {
    "北海道": "北海道",
    "青森県": "東北",
    "岩手県": "東北",
    "宮城県": "東北",
    "秋田県": "東北",
    "山形県": "東北",
    "福島県": "東北",
    "茨城県": "関東",
    "栃木県": "関東",
    "群馬県": "関東",
    "埼玉県": "関東",
    "千葉県": "関東",
    "東京都": "関東",
    "神奈川県": "関東",
    "新潟県": "中部",
    "富山県": "中部",
    "石川県": "中部",
    "福井県": "中部",
    "山梨県": "中部",
    "長野県": "中部",
    "岐阜県": "中部",
    "静岡県": "中部",
    "愛知県": "中部",
    "三重県": "近畿",
    "滋賀県": "近畿",
    "京都府": "近畿",
    "大阪府": "近畿",
    "兵庫県": "近畿",
    "奈良県": "近畿",
    "和歌山県": "近畿",
    "鳥取県": "中国",
    "島根県": "中国",
    "岡山県": "中国",
    "広島県": "中国",
    "山口県": "中国",
    "徳島県": "四国",
    "香川県": "四国",
    "愛媛県": "四国",
    "高知県": "四国",
    "福岡県": "九州",
    "佐賀県": "九州",
    "長崎県": "九州",
    "熊本県": "九州",
    "大分県": "九州",
    "宮崎県": "九州",
    "鹿児島県": "九州",
    "沖縄県": "沖縄"
  };
  return regionMap[pref] || "その他";
}
