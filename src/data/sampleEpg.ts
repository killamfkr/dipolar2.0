// Sample XMLTV EPG for demo. Replace with your own EPG URL.
export const SAMPLE_XMLTV = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="bbc-one">
    <display-name>BBC One</display-name>
    <icon src="https://upload.wikimedia.org/wikipedia/commons/e/eb/BBC_one_logo_2022.svg"/>
  </channel>
  <channel id="bbc-two">
    <display-name>BBC Two</display-name>
    <icon src="https://upload.wikimedia.org/wikipedia/commons/3/3b/BBC_Two_2022_Ident.svg"/>
  </channel>
  <channel id="sky-news">
    <display-name>Sky News</display-name>
  </channel>
  <channel id="sport-hd">
    <display-name>Sport HD</display-name>
  </channel>
  <channel id="movie-channel">
    <display-name>Movies 24/7</display-name>
  </channel>
  <programme channel="bbc-one" start="20240315120000 +0000" stop="20240315130000 +0000">
    <title>Morning News</title>
    <desc>Latest headlines and weather.</desc>
    <category>News</category>
  </programme>
  <programme channel="bbc-one" start="20240315130000 +0000" stop="20240315140000 +0000">
    <title>Daytime Drama</title>
    <desc>Afternoon series.</desc>
    <category>Drama</category>
  </programme>
  <programme channel="bbc-one" start="20240315140000 +0000" stop="20240315153000 +0000">
    <title>Sports Roundup</title>
    <category>Sports</category>
  </programme>
  <programme channel="bbc-two" start="20240315110000 +0000" stop="20240315120000 +0000">
    <title>Documentary Hour</title>
    <category>Documentary</category>
  </programme>
  <programme channel="bbc-two" start="20240315120000 +0000" stop="20240315140000 +0000">
    <title>Film: Classic Cinema</title>
    <category>Movie</category>
  </programme>
  <programme channel="sky-news" start="20240315060000 +0000" stop="20240316060000 +0000">
    <title>Sky News Live</title>
    <desc>24/7 news coverage.</desc>
    <category>News</category>
  </programme>
  <programme channel="sport-hd" start="20240315100000 +0000" stop="20240315120000 +0000">
    <title>Football Highlights</title>
    <category>Sports</category>
  </programme>
  <programme channel="sport-hd" start="20240315120000 +0000" stop="20240315150000 +0000">
    <title>Live: Premier League</title>
    <category>Sports</category>
  </programme>
  <programme channel="movie-channel" start="20240315000000 +0000" stop="20240315120000 +0000">
    <title>Action Blockbuster</title>
    <category>Movie</category>
  </programme>
  <programme channel="movie-channel" start="20240315120000 +0000" stop="20240315140000 +0000">
    <title>Comedy Night</title>
    <category>Movie</category>
  </programme>
</tv>`;
