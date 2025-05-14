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

export class SongQueue {
  private queue: Song[];
  private current: Song;
  private isLooping: "None" | "One" | "All";
  public collector;
  public justSeeked: boolean = false;
  public justSkipped: boolean = false;

  public constructor() {
    this.queue = [];
    this.current = undefined;
    this.isLooping = "None";
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
