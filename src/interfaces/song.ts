export interface Song {
  title: string;
  url: string;
  thumbnail_url: string;
  duration: number;
  seek: number;
  isYoutubeBased: boolean;
  isFile?: boolean;
  isLive?: boolean;
}

export type SongQueueLoopingMode = "None" | "One" | "All";
export type SongQueueAutoPlaySource = "Youtube Music" | "Youtube Normal";
export type SongQueueAutoPlayMode = "None" | SongQueueAutoPlaySource;

export class SongQueue {
  private queue: Song[];
  private current: Song;
  private mostRecentSongsUrlsCache: string[];
  private readonly MAX_RECENT_SONGS_CACHE_SIZE = 5;
  private isLooping: SongQueueLoopingMode;
  private autoPlay: SongQueueAutoPlayMode;
  public collector;
  public justSeeked: boolean = false;
  public justSkipped: boolean = false;

  public constructor() {
    this.queue = [];
    this.mostRecentSongsUrlsCache = [];
    this.current = undefined;
    this.isLooping = "None";
    this.autoPlay = "None";
  }

  public getCurrent() {
    return this.current;
  }

  public front() {
    return this.queue[0];
  }

  public last() {
    return this.queue[this.queue.length - 1];
  }

  public length() {
    return this.queue.length;
  }

  public isEmpty() {
    return this.queue.length === 0;
  }

  public getAllSongs(): Song[] {
    return this.queue;
  }

  public isInMostRecentSongsCache(song: Song) {
    if (!song) return false;
    return this.mostRecentSongsUrlsCache.includes(song.url);
  }

  public isAutoPlayEnabled() {
    return this.autoPlay !== "None";
  }

  public getAutoPlayMode() {
    return this.autoPlay;
  }

  public shouldAutoPlayNext() {
    return this.isAutoPlayEnabled() && this.queue.length <= 1;
  }

  public setAutoPlay(value: SongQueueAutoPlayMode) {
    this.autoPlay = value;
  }

  public nextAutoPlayMode() {
    switch (this.autoPlay) {
      case "None":
        this.autoPlay = "Youtube Music";
        break;
      case "Youtube Music":
        this.autoPlay = "Youtube Normal";
        break;
      case "Youtube Normal":
        this.autoPlay = "None";
        break;
    }
    return this.autoPlay;
  }

  public isLoopingEnabled() {
    return this.isLooping !== "None";
  }

  public getLoopingMode() {
    return this.isLooping;
  }

  public setLoopingMode(mode: SongQueueLoopingMode) {
    this.isLooping = mode;
  }

  public nextLoopingMode() {
    switch (this.isLooping) {
      case "None":
        this.isLooping = "One";
        break;
      case "One":
        this.isLooping = "All";
        break;
      case "All":
        this.isLooping = "None";
        break;
    }
    return {
      isLooping: this.isLooping,
      loopedSong: this.current,
    };
  }

  public push(song: Song) {
    this.queue.push(song);
    const length = this.mostRecentSongsUrlsCache.unshift(song.url);
    if (length > this.MAX_RECENT_SONGS_CACHE_SIZE) {
      this.mostRecentSongsUrlsCache.pop();
    }
  }

  public pop() {
    if (this.isLooping === "None" || !this.current) {
      this.current = this.removeFront();
      return this.current;
    }

    if (this.isLooping === "One" && this.current) {
      this.current.seek = 0;
      return this.current;
    }

    if (this.isLooping === "All" && this.current) {
      this.current.seek = 0;
      this.queue.push(this.current);
      this.current = this.removeFront();
      return this.current;
    }

    return this.current;
  }

  public removeFront(): Song {
    return this.queue.shift();
  }

  public removeLast(): Song {
    return this.queue.pop();
  }

  public removeAt(index: number): Song {
    if (index <= 0) {
      return this.removeFront();
    } else if (index >= this.queue.length) {
      return this.removeLast();
    } else {
      const temp = this.queue[index];
      this.queue.splice(index, 1);
      return temp;
    }
  }

  public removeAll() {
    this.queue.length = 0;
  }

  public reset() {
    this.removeAll();
    this.current = undefined;
  }
}
