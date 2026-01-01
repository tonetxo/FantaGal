# CMakeLists.txt for FantaGal Native Audio Engine
cmake_minimum_required(VERSION 3.22.1)
project("fantagal_audio")

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Oboe package (included with NDK 26+, or use FetchContent)
include(FetchContent)
FetchContent_Declare(
    oboe
    GIT_REPOSITORY https://github.com/google/oboe.git
    GIT_TAG 1.8.0
)
FetchContent_MakeAvailable(oboe)

# Source files
set(AUDIO_SOURCES
    NativeAudioEngine.cpp
    engines/CriosferaEngine.cpp
    engines/GearheartEngine.cpp
    jni/native-lib.cpp
)

# Create shared library
add_library(${PROJECT_NAME} SHARED ${AUDIO_SOURCES})

# Include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/engines
    ${oboe_SOURCE_DIR}/include
)

# Link libraries
target_link_libraries(${PROJECT_NAME}
    oboe
    android
    log
)

# Compiler options for performance
target_compile_options(${PROJECT_NAME} PRIVATE
    -Wall
    -Werror
    -O3
    -ffast-math
)
