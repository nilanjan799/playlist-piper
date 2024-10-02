import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { google } from 'googleapis';
import { decode } from 'he';
import * as dotenv from 'dotenv';
import * as querystring from 'querystring';

dotenv.config();

@Injectable()
export class AppService {
  private oathclient;
  private googleClientId: string = process.env.GOOGLE_CLIENT_ID;
  private googleClientSecret: string = process.env.GOOGLE_CLIENT_SECRET;
  private spotifyClientId: string = process.env.SPOTIFY_CLIENT_ID;
  private spotifyClientSecret: string = process.env.SPOTIFY_CLIENT_SECRET;

  constructor(){
    this.oathclient = new google.auth.OAuth2(this.googleClientId, this.googleClientSecret, 'http://localhost:3000/callback');
   
  }

  getHello(): string {
    return 'Hello World!';
  }

  generateAuthUrl(){
    const scopes = [
      'https://www.googleapis.com/auth/youtube'
    ];
    const url = this.oathclient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes
    });
    return url;
  }

  async getTokens(code: string){
    const { tokens } = await this.oathclient.getToken(code);
    return tokens;
  }

  getYoutubeClient(accessToken: string){
    this.oathclient.setCredentials({access_token: accessToken});
    return google.youtube({
      version: 'v3',
      auth: this.oathclient
    });
  }

  async createPlaylist(accessToken: string, playlistTitle: string){   
    const youtubeClient = this.getYoutubeClient(accessToken);
    const response = await youtubeClient.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: playlistTitle,
          description: 'Created by playlist-piper.',
        },
        status: {
          privacyStatus: 'public',
        },
      },
    });

    return response.data;
  }

  async searchSong(query: string, artist: string, accessToken: string){
    const ytClient = this.getYoutubeClient(accessToken);
    const response = await ytClient.search.list({
      part: ['snippet'],
      q: query,
      maxResults: 20,
      type: ['video'],      
    });

    let videoItems = response.data.items;

    videoItems = videoItems.filter(x => {
      const channelName = decode(x.snippet.channelTitle).toLowerCase();
      const videoTitle = decode(x.snippet.title).toLowerCase();
      return (channelName.includes(artist.trim()) || videoTitle.includes(artist.trim())) && videoTitle.includes(query.trim());
    });

    const videoIds = videoItems.map(item => item.id.videoId);
    const videoDetailsResponse = await ytClient.videos.list({
      part: ['snippet', 'statistics'],
      id: videoIds,
    });

    const videosWithStats = videoDetailsResponse.data.items.map(x => {
      return {
        id: x.id,
        title: x.snippet.title,
        channel: x.snippet.channelTitle,
        viewCount: parseInt(x.statistics.viewCount, 10)
      };
    }
    ); 

    const topVideo = videosWithStats.reduce((prev, current) =>
      current.viewCount > prev.viewCount ? current : prev
    );

    return topVideo;
  }

  async insertIntoPlaylist(accessToken: string, playlistId: string, videoId: string){
    const ytClient = this.getYoutubeClient(accessToken);
    const response = await ytClient.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId: playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId: videoId
          }
        }
      }
    });

    return response.data;
  }

  spotifyLoginUrl(){
    const redirectUrl = 'http://localhost:3000/callbackSpotify';
    const scope = 'user-read-private playlist-read-private';

    const authUrl = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: this.spotifyClientId,
      scope: scope,
      redirect_uri: redirectUrl,
    });

    return authUrl;
  }

  async fetchSpotifyPlaylists(accessToken: string){
    const userResponse = await axios.get('https://api.spotify.com/v1/me',{
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userId = userResponse.data.id;

    const playlistsResponse = await axios.get(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return playlistsResponse.data.items;
  }

  async fetchTracksByPlaylistId(playlistId: string, accessToken: string){
    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const tracks = response.data.items.map(x => {
      return{
        trackName: x.track.name,
        albumName: x.track.album.name ?? '',
        artists: x.track.artists?.map(y => y.name).join(' ') ?? ''
      };
    })

    return tracks;
  }

  async copyPlaylistIntoYoutube(googAccessToken, sptfyAccessToken, sptfyPlaylistId){
    const ytClient = this.getYoutubeClient(googAccessToken);

    const tracks = await this.fetchTracksByPlaylistId(sptfyPlaylistId, sptfyAccessToken);

    const googPlaylistId = (await this.createPlaylist(googAccessToken, 'goto - mostly rock')).id;

    for(const track of tracks){
      const query = `${track.trackName} ${track.artists} album: ${track.albumName}`;
      const searchResponse = await ytClient.search.list({
        part: ['snippet'],
        q: query,
        maxResults: 1,
        type: ['video'],      
      });
      const videoId = searchResponse.data.items[0].id.videoId;
      await this.insertIntoPlaylist(googAccessToken, googPlaylistId, videoId);
    }    
    
  }

}
