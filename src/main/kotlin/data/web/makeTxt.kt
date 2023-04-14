package data.web

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedWriter
import java.nio.file.Path
import kotlin.io.path.bufferedWriter
import kotlin.io.path.createFile
import kotlin.io.path.notExists

suspend fun makeTxtFile(
    filePath: Path,
    lang: BookFileLang,
    metadata: BookMetadata,
    episodes: Map<String, BookEpisode>,
) {
    withContext(Dispatchers.IO) {
        if (filePath.notExists()) {
            filePath.createFile()
        }
        filePath.bufferedWriter().use {
            val writer: TxtWriter = when (lang) {
                BookFileLang.JP -> TxtMakerJp
                BookFileLang.ZH_BAIDU -> TxtMakerZh { ep -> ep.baiduParagraphs }
                BookFileLang.ZH_YOUDAO -> TxtMakerZh { ep -> ep.youdaoParagraphs }
                BookFileLang.MIX_BAIDU -> TxtMakerMix(TxtMakerZh { ep -> ep.baiduParagraphs })
                BookFileLang.MIX_YOUDAO -> TxtMakerMix(TxtMakerZh { ep -> ep.youdaoParagraphs })
            }
            with(it) { with(writer) { writeBook(metadata, episodes) } }
        }
    }
}

private const val MISSING_EPISODE_HINT = "该章节缺失。\n\n"

private abstract class TxtWriter {
    abstract fun BufferedWriter.writeTitle(metadata: BookMetadata)
    abstract fun BufferedWriter.writeIntroduction(metadata: BookMetadata)
    abstract fun BufferedWriter.writeTocItemTitle(item: BookTocItem)
    abstract fun BufferedWriter.writeEpisode(episode: BookEpisode)

    fun BufferedWriter.writeAuthor(metadata: BookMetadata) {
        metadata.authors.forEach { author ->
            write(author.name)
            if (author.link != null) {
                write("[${author.link}]")
            }
            write("\n")
        }
    }

    fun BufferedWriter.writeMissingEpisode() {
        write(MISSING_EPISODE_HINT)
    }

    fun BufferedWriter.writeBook(
        metadata: BookMetadata,
        episodes: Map<String, BookEpisode>,
    ) {
        writeTitle(metadata)
        write("\n")
        writeAuthor(metadata)
        write("\n")
        write("#".repeat(12) + "\n")
        writeIntroduction(metadata)
        write("\n\n\n")

        metadata.toc.forEach { item ->
            writeTocItemTitle(item)
            write("\n")

            if (item.episodeId != null) {
                val episode = episodes[item.episodeId]
                if (episode == null) {
                    writeMissingEpisode()
                } else {
                    writeEpisode(episode)
                }
                write("\n\n\n")
            }
        }
    }
}

private object TxtMakerJp : TxtWriter() {
    override fun BufferedWriter.writeTitle(metadata: BookMetadata) {
        write(metadata.titleJp + "\n")
    }

    override fun BufferedWriter.writeIntroduction(metadata: BookMetadata) {
        if (metadata.introductionJp.isNotBlank()) {
            write(metadata.introductionJp)
            write("\n")
        }
    }

    override fun BufferedWriter.writeTocItemTitle(item: BookTocItem) {
        write("# ${item.titleJp}\n")
    }

    override fun BufferedWriter.writeEpisode(episode: BookEpisode) {
        episode.paragraphs.forEach { text -> write(text + "\n") }
    }
}

private class TxtMakerZh(
    private val getParagraphs: (BookEpisode) -> List<String>?
) : TxtWriter() {
    override fun BufferedWriter.writeTitle(metadata: BookMetadata) {
        write((metadata.titleZh ?: metadata.titleJp) + "\n")
    }

    override fun BufferedWriter.writeIntroduction(metadata: BookMetadata) {
        if (!metadata.introductionZh.isNullOrBlank()) {
            write(metadata.introductionZh)
            write("\n")
        }
    }

    override fun BufferedWriter.writeTocItemTitle(item: BookTocItem) {
        write("# ${item.titleZh ?: item.titleJp}\n")
    }

    override fun BufferedWriter.writeEpisode(episode: BookEpisode) {
        val paragraphs = getParagraphs(episode)
        if (paragraphs == null) {
            writeMissingEpisode()
        } else {
            paragraphs.forEach { text -> write(text + "\n") }
        }
    }
}

private class TxtMakerMix(
    private val txtMakerZh: TxtMakerZh,
) : TxtWriter() {
    override fun BufferedWriter.writeTitle(metadata: BookMetadata) {
        with(TxtMakerJp) { writeTitle(metadata) }
        with(txtMakerZh) { writeTitle(metadata) }
    }

    override fun BufferedWriter.writeIntroduction(metadata: BookMetadata) {
        with(TxtMakerJp) { writeIntroduction(metadata) }
        with(txtMakerZh) { writeIntroduction(metadata) }
    }

    override fun BufferedWriter.writeTocItemTitle(item: BookTocItem) {
        with(TxtMakerJp) { writeTocItemTitle(item) }
        with(txtMakerZh) { writeTocItemTitle(item) }
    }

    override fun BufferedWriter.writeEpisode(episode: BookEpisode) {
        if (episode.baiduParagraphs == null) {
            writeMissingEpisode()
        } else {
            episode.paragraphs.zip(episode.baiduParagraphs).forEach { (textJp, textZh) ->
                if (textJp.isNotBlank()) {
                    write(textZh + "\n")
                    write(textJp + "\n")
                } else {
                    write(textJp + "\n")
                }
            }
        }
    }
}