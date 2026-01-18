// Typescript definitions for photo plugin
interface PhotoCommands {
  /**
   * 获取相册中所有图片的路径列表
   * @returns {Promise<string[]>} 图片路径数组
   */
  get_album_paths(): Promise<string[]>;
}

export default PhotoCommands;
