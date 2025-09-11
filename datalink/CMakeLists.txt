cmake_minimum_required(VERSION 3.16)
project(DataLinkService LANGUAGES CXX)

# =========================
# Genel C++ ayarları
# =========================
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# =========================
# Derleyiciye özel ayarlar
# =========================
if(MINGW)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -static-libgcc -static-libstdc++ -pipe")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -static")
elseif(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /MP")
endif()

# =========================
# gRPC / Protobuf / Abseil yolları
# =========================
set(CMAKE_PREFIX_PATH
    "C:/users/stj.htinaztepe/desktop/installpc_protobuf3203"  # Protobuf 3.20.3
    "C:/users/stj.htinaztepe/desktop/installpc"               # gRPC + Abseil
)

set(Protobuf_PROTOC_EXECUTABLE
    "C:/users/stj.htinaztepe/desktop/installpc_protobuf3203/bin/protoc.exe"
)

# =========================
# Paketleri bul
# =========================
find_package(Protobuf REQUIRED)
find_package(gRPC CONFIG REQUIRED)
find_package(absl CONFIG REQUIRED)

# =========================
# Kaynak dosyalar
# =========================
set(SRC_FILES
    ${CMAKE_CURRENT_SOURCE_DIR}/main.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/datalinkservice.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/generated/datalink.pb.cc
    ${CMAKE_CURRENT_SOURCE_DIR}/generated/datalink.grpc.pb.cc
)

add_executable(datalink_server ${SRC_FILES})

# =========================
# Include dizinleri
# =========================
target_include_directories(datalink_server PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/proto
    ${CMAKE_CURRENT_SOURCE_DIR}/generated
    ${Protobuf_INCLUDE_DIRS}
)

# =========================
# Linkleme
# =========================
target_link_libraries(datalink_server PRIVATE
    gRPC::grpc++
    gRPC::grpc++_reflection
    protobuf::libprotobuf
    absl::strings
    absl::base
)

if(MINGW)
    target_link_libraries(datalink_server PRIVATE
        ws2_32
        wsock32
        crypt32
        winmm
        pthread
    )
endif()

# =========================
# Ninja optimizasyonları
# =========================
if(CMAKE_GENERATOR STREQUAL "Ninja")
    set(CMAKE_VERBOSE_MAKEFILE ON CACHE BOOL "Verbose output" FORCE)
    include(ProcessorCount)
    ProcessorCount(N)
    if(NOT N EQUAL 0)
        set(CMAKE_BUILD_PARALLEL_LEVEL ${N})
    endif()
endif()

# =========================
# Build tipine göre ayarlar
# =========================
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_definitions(datalink_server PRIVATE DEBUG=1)
    if(MINGW)
        set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0")
    endif()
elseif(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MINGW)
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -DNDEBUG")
    endif()
endif()

# =========================
# Install
# =========================
install(TARGETS datalink_server
    RUNTIME DESTINATION bin
)
