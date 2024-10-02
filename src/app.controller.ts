import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiQuery } from '@nestjs/swagger';
import * as querystring from 'querystring';
import axios from 'axios';
import { appsactivity } from 'googleapis/build/src/apis/appsactivity';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('login')
  async login(){
    const url = this.appService.generateAuthUrl();
    return url;
  }

  @Get('callback')
  async callback(@Query('code') code:string): Promise<string>{
    const tokens = await this.appService.getTokens(code);
    const accessToken = tokens.access_token;
    return accessToken;
  }

  @ApiQuery({name: 'accessToken', type: 'string'})
  @ApiQuery({name: 'playlistTitle', type: 'string'})
  @Get('create-playlist')
  async createPlaylist(@Query('accessToken') accessToken: string, @Query('playlistTitle') playlistTitle: string){
    try{
    const response = await this.appService.createPlaylist(accessToken, playlistTitle);
    return response;
    }
    catch(error){
      return { message: 'error', error: error.message};
    }    
  }

  @ApiQuery({name: 'query', type: 'string'})
  @ApiQuery({name: 'artist', type: 'string'})
  @ApiQuery({name: 'accessToken', type: 'string'})
  @Get('youtube-search')
  async searchSong(@Query('query') query: string, @Query('artist') artist: string, @Query('accessToken') accessToken: string){
    try{
      const response = this.appService.searchSong(query, artist, accessToken);
      return response;
    }
    catch(error){
      return { message: 'error', error: error.message};
    }
  }

  @ApiQuery({name: 'accessToken', type: 'string'})
  @ApiQuery({name: 'playlistId', type: 'string'})
  @ApiQuery({name: 'videoId', type: 'string'})
  @Get('insert-video')
  async insertVideo(@Query('accessToken') accessToken: string, @Query('playlistId') playlistId: string, @Query('videoId') videoId: string){
    return this.appService.insertIntoPlaylist(accessToken, playlistId, videoId);
  }


  @Get('spotify-login')
  async spotifyLogin(){
    const authUrl = this.appService.spotifyLoginUrl();
    return authUrl;
  }

  @Get('callbackSpotify')
  async spotifyCallback(@Query('code') code: string){
    const clientId = 'c1d579c204604e2d91d68c7d828acfa5';
    const clientSecret = '786a9be24d0541c3a63df5c643d913a3';
    const redirectUrl = 'http://localhost:3000/callbackSpotify';

    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUrl,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return tokenResponse.data;
  }

  @Get('getspotifyplaylists')
  async getSpotifyPlaylists(@Query('accessToken') accessToken: string){
    const playlists = await this.appService.fetchSpotifyPlaylists(accessToken);
    return playlists;
  }

  @ApiQuery({name: 'playlistId', type: 'string'})
  @ApiQuery({name: 'accessToken', type: 'string'})
  @Get('fetchtracks-byplaylistid')
  async fetchPlaylistTracks(@Query('playlistId') playlistId: string, @Query('accessToken') accessToken: string){
    return await this.appService.fetchTracksByPlaylistId(playlistId, accessToken);
  }

  @ApiQuery({name: 'googAccessToken', type: 'string'})
  @ApiQuery({name: 'sptfyAccessToken', type: 'string'})
  @ApiQuery({name: 'playlistId', type: 'string'})
  @Get('copy-playlist')
  async copyPlaylist(@Query('googAccessToken') googAccessToken: string, @Query('sptfyAccessToken') sptfyAccessToken: string, 
  @Query('playlistId') playlistId: string, @Res() res){
    await this.appService.copyPlaylistIntoYoutube(googAccessToken, sptfyAccessToken, playlistId);
    return res.status(200).send();
  }
}
