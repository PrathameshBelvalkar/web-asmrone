package echo.web

import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import io.ktor.server.response.respondFile
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import dev.brahmkshatriya.echo.common.helpers.ClientException
import kotlinx.coroutines.runBlocking
import java.io.File

private fun findFrontendDist(): File? {
    System.getenv("ECHO_WEB_DIST")?.let { return File(it).takeIf { d -> d.isDirectory } }
    return listOf("../../frontend/dist", "../frontend/dist", "web/frontend/dist")
        .map { File(it) }.firstOrNull { it.isDirectory }
}

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    val dist = findFrontendDist()
    runBlocking { Host.init() }
    println("Echo Web on http://127.0.0.1:$port  (frontend: ${dist?.path ?: "not built"})")
    embeddedServer(Netty, port = port, host = "127.0.0.1") { module(dist) }.start(wait = true)
}

fun Application.module(dist: File?) {
    install(ContentNegotiation) { json(Codec.json) }
    install(StatusPages) {
        exception<BadRequestException> { call, e ->
            call.respond(HttpStatusCode.BadRequest, ErrorDto("bad_request", e.message))
        }
        exception<ClientException.Unauthorized> { call, e ->
            Host.users.clear()
            Host.io { setLoginUser(null) }
            call.respond(HttpStatusCode.Unauthorized, ErrorDto("unauthorized", e.userId))
        }
        exception<ClientException.LoginRequired> { call, _ ->
            call.respond(HttpStatusCode.Unauthorized, ErrorDto("login_required"))
        }
        exception<ClientException.NotSupported> { call, e ->
            call.respond(HttpStatusCode.NotImplemented, ErrorDto("not_supported", e.operation))
        }
        exception<Throwable> { call, e ->
            e.printStackTrace()
            call.respond(HttpStatusCode.InternalServerError, ErrorDto("other", e.message ?: e::class.simpleName))
        }
    }
    routing {
        api()
        if (dist != null) {
            // Serve built files; anything else (client-side routes) gets index.html.
            val root = dist.canonicalFile
            get("{path...}") {
                val rel = call.parameters.getAll("path")?.joinToString("/").orEmpty()
                val file = File(root, rel).canonicalFile
                if (rel.isNotEmpty() && file.isFile && file.toPath().startsWith(root.toPath())) {
                    call.respondFile(file)
                } else {
                    call.respondFile(File(root, "index.html"))
                }
            }
        } else {
            get("/") {
                call.respondText(
                    "Echo Web API is running. Build the frontend (web/frontend) to serve the UI.",
                    ContentType.Text.Plain
                )
            }
        }
    }
}
